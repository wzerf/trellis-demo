const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
  process.exit(1);
}

let graph;
try {
  graph = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
} catch (err) {
  console.error('Failed to read input:', err.message);
  process.exit(1);
}

const { nodes = [], edges = [], layers = [] } = graph;

// Build ID index
const nodeById = new Map(nodes.map(n => [n.id, n]));

// A. Fan-In
const fanIn = new Map();
const fanOut = new Map();
for (const n of nodes) {
  fanIn.set(n.id, 0);
  fanOut.set(n.id, 0);
}
for (const e of edges) {
  if (fanIn.has(e.target)) fanIn.set(e.target, fanIn.get(e.target) + 1);
  if (fanOut.has(e.source)) fanOut.set(e.source, fanOut.get(e.source) + 1);
}

const fanInRanking = [...fanIn.entries()]
  .map(([id, count]) => ({
    id,
    fanIn: count,
    name: nodeById.get(id)?.name || '',
    type: nodeById.get(id)?.type || ''
  }))
  .filter(x => x.fanIn > 0)
  .sort((a, b) => b.fanIn - a.fanIn)
  .slice(0, 20);

const fanOutRanking = [...fanOut.entries()]
  .map(([id, count]) => ({
    id,
    fanOut: count,
    name: nodeById.get(id)?.name || '',
    type: nodeById.get(id)?.type || ''
  }))
  .filter(x => x.fanOut > 0)
  .sort((a, b) => b.fanOut - a.fanOut)
  .slice(0, 20);

// C. Entry Point Candidates
const ENTRY_FILE_PATTERNS = [
  /^index\.(ts|js|tsx|jsx)$/,
  /^main\.(ts|js|tsx|jsx)$/,
  /^app\.(ts|js|tsx|jsx)$/,
  /^server\.(ts|js)$/,
  /^mod\.rs$/,
  /^main\.(go|py|rs|cpp|c)$/,
  /^manage\.py$/,
  /^app\.py$/,
  /^wsgi\.py$/,
  /^asgi\.py$/,
  /^run\.py$/,
  /^__main__\.py$/,
  /^Application\.(java|kt)$/,
  /^Main\.(java|kt|cs)$/,
  /^Program\.cs$/,
  /^config\.ru$/,
  /^index\.php$/,
  /^App\.swift$/
];

const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
const lowFanInThreshold = fanInValues[Math.floor(fanInValues.length * 0.25)] ?? 0;
const top10FanOutThreshold = [...fanOut.values()].sort((a, b) => b - a)[Math.floor(nodes.length * 0.10)] ?? 0;

const entryPointCandidates = [];
for (const n of nodes) {
  let score = 0;
  if (n.type === 'file') {
    const baseName = path.basename(n.filePath || n.name || '');
    if (ENTRY_FILE_PATTERNS.some(rx => rx.test(baseName))) score += 3;
    // Root or one level deep
    const parts = (n.filePath || '').split('/');
    if (parts.length <= 2) score += 1;
    else if (parts.length <= 3) score += 1;
    if ((fanOut.get(n.id) || 0) >= top10FanOutThreshold) score += 1;
    if ((fanIn.get(n.id) || 0) <= lowFanInThreshold) score += 1;
  } else if (n.type === 'document') {
    if ((n.filePath || '').endsWith('README.md') && (n.filePath || '').split('/').length <= 1) score += 5;
    else if ((n.name || '').toLowerCase().endsWith('.md') && (n.filePath || '').split('/').length <= 1) score += 2;
  }
  if (score > 0) {
    entryPointCandidates.push({
      id: n.id,
      score,
      name: n.name,
      type: n.type,
      summary: n.summary,
      filePath: n.filePath
    });
  }
}
entryPointCandidates.sort((a, b) => b.score - a.score);
const topEntryPoints = entryPointCandidates.slice(0, 5);

// D. BFS from top code entry point
const topCodeEntry = entryPointCandidates.find(c => c.type === 'file') || entryPointCandidates[0];
const bfsStart = topCodeEntry?.id;
const bfsTraversal = { startNode: bfsStart, order: [], depthMap: {}, byDepth: {} };
if (bfsStart) {
  const visited = new Set();
  const queue = [{ id: bfsStart, depth: 0 }];
  const adj = new Map();
  for (const e of edges) {
    if (e.type === 'imports' || e.type === 'calls') {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source).push(e.target);
    }
  }
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    bfsTraversal.order.push(id);
    bfsTraversal.depthMap[id] = depth;
    if (!bfsTraversal.byDepth[depth]) bfsTraversal.byDepth[depth] = [];
    bfsTraversal.byDepth[depth].push(id);
    const neighbors = adj.get(id) || [];
    for (const next of neighbors) {
      if (!visited.has(next) && nodeById.has(next)) {
        queue.push({ id: next, depth: depth + 1 });
      }
    }
  }
}

// E. Non-Code File Inventory
const nonCodeFiles = {
  documentation: [],
  infrastructure: [],
  data: [],
  config: []
};
for (const n of nodes) {
  if (n.type === 'document') {
    nonCodeFiles.documentation.push({ id: n.id, name: n.name, summary: n.summary, filePath: n.filePath });
  } else if (['service', 'pipeline', 'resource'].includes(n.type)) {
    nonCodeFiles.infrastructure.push({ id: n.id, name: n.name, summary: n.summary, type: n.type });
  } else if (['table', 'schema', 'endpoint'].includes(n.type)) {
    nonCodeFiles.data.push({ id: n.id, name: n.name, summary: n.summary, type: n.type });
  } else if (n.type === 'config') {
    nonCodeFiles.config.push({ id: n.id, name: n.name, summary: n.summary, filePath: n.filePath });
  }
}

// F. Clusters (bidirectional relationships)
const adjAll = new Map();
const reverseAdj = new Map();
for (const e of edges) {
  if (!adjAll.has(e.source)) adjAll.set(e.source, new Set());
  if (!adjAll.has(e.target)) adjAll.set(e.target, new Set());
  if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, new Set());
  if (!reverseAdj.has(e.source)) reverseAdj.set(e.source, new Set());
  adjAll.get(e.source).add(e.target);
  reverseAdj.get(e.target).add(e.source);
}
const clusterMap = new Map();
for (const e of edges) {
  const a = e.source, b = e.target;
  if (adjAll.get(a)?.has(b) && adjAll.get(b)?.has(a)) {
    const key = [a, b].sort().join('|');
    if (!clusterMap.has(key)) clusterMap.set(key, { nodes: [a, b], edgeCount: 2 });
    else clusterMap.get(key).edgeCount += 1;
  }
}
// Expand clusters
let clusters = [...clusterMap.values()];
const usedNodes = new Set();
for (const c of clusters) c.nodes.forEach(n => usedNodes.add(n));
const expanded = [];
for (const c of clusters) {
  const memberSet = new Set(c.nodes);
  // find additional nodes connecting to >=2 members
  const candidates = new Map();
  for (const m of c.nodes) {
    for (const nb of [...(adjAll.get(m) || []), ...(reverseAdj.get(m) || [])]) {
      if (!memberSet.has(nb)) {
        candidates.set(nb, (candidates.get(nb) || 0) + 1);
      }
    }
  }
  for (const [nb, count] of candidates) {
    if (count >= 2 && !usedNodes.has(nb) && c.nodes.length < 5) {
      c.nodes.push(nb);
      memberSet.add(nb);
      c.edgeCount += count;
    }
  }
  expanded.push(c);
}
const topClusters = expanded.slice(0, 10);

// G. Layers
const layerList = layers.map(l => ({ id: l.id, name: l.name, description: l.description }));

// H. Node Summary Index
const nodeSummaryIndex = {};
for (const n of nodes) {
  nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary };
}

const result = {
  scriptCompleted: true,
  entryPointCandidates: topEntryPoints,
  fanInRanking,
  fanOutRanking,
  bfsTraversal,
  nonCodeFiles,
  clusters: topClusters,
  layers: { count: layerList.length, list: layerList },
  nodeSummaryIndex,
  totalNodes: nodes.length,
  totalEdges: edges.length
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('Analysis complete:', nodes.length, 'nodes,', edges.length, 'edges');
