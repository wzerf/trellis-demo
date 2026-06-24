#!/usr/bin/env node
// Convert assembled-graph.json to ua-arch-input.json
const fs = require('fs');

const graphFile = process.argv[2];
const outFile = process.argv[3];

const graph = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
const FILE_TYPES = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);

const fileNodes = graph.nodes.filter(n => FILE_TYPES.has(n.type));
const fileNodeIds = new Set(fileNodes.map(n => n.id));
const edges = (graph.edges || []).filter(e => fileNodeIds.has(e.source) && fileNodeIds.has(e.target));

const importEdges = edges.filter(e => e.type === 'imports');

const input = {
  fileNodes: fileNodes.map(n => ({
    id: n.id,
    type: n.type,
    name: n.name,
    filePath: n.filePath,
    summary: n.summary,
    tags: n.tags || [],
  })),
  importEdges: importEdges.map(e => ({ source: e.source, target: e.target, type: e.type })),
  allEdges: edges.map(e => ({ source: e.source, target: e.target, type: e.type })),
};

fs.writeFileSync(outFile, JSON.stringify(input, null, 2));
console.log(`Wrote ${fileNodes.length} file nodes and ${edges.length} edges to ${outFile}`);
