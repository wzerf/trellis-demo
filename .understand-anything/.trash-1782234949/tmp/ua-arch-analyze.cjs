#!/usr/bin/env node
// Analyze the assembled graph and compute structural patterns
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: ua-arch-analyze.js <input.json> <output.json>');
  process.exit(1);
}

const graph = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const nodes = graph.fileNodes || graph.nodes || [];
const edges = graph.allEdges || graph.importEdges || graph.edges || [];

// File-level node types we care about
const FILE_TYPES = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);

const fileNodes = nodes.filter(n => FILE_TYPES.has(n.type));
const fileNodeIds = new Set(fileNodes.map(n => n.id));

const fileEdges = edges.filter(e => fileNodeIds.has(e.source) && fileNodeIds.has(e.target));

// === A. Directory Grouping ===
function dirGroup(filePath) {
  if (!filePath) return 'root';
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length <= 1) return 'root';
  // Skip top-level prefixes: backend/, apps/, packages/ etc.
  // Common: backend/db/..., backend/java-admin/...
  // Use second segment for most cases
  if (parts[0] === 'backend' && parts.length >= 3) {
    if (parts[1] === 'java-admin') {
      // backend/java-admin/<module>/...
      return `java-admin/${parts[2]}`;
    }
    return `backend/${parts[1]}`;
  }
  if (parts[0] === 'apps' && parts.length >= 2) {
    return `apps/${parts[1]}`;
  }
  if (parts[0] === 'packages' && parts.length >= 2) {
    return `packages/${parts[1]}`;
  }
  if (parts[0] === '.github' || parts[0] === '.husky') {
    return parts[0];
  }
  if (parts[0] === '.claude' || parts[0] === '.understand-anything') {
    return parts[0];
  }
  return parts[0];
}

const directoryGroups = {};
const nodeTypeGroups = {};
const fileFanIn = {};
const fileFanOut = {};

fileNodes.forEach(n => {
  const g = dirGroup(n.filePath);
  if (!directoryGroups[g]) directoryGroups[g] = [];
  directoryGroups[g].push(n.id);
  if (!nodeTypeGroups[n.type]) nodeTypeGroups[n.type] = [];
  nodeTypeGroups[n.type].push(n.id);
  fileFanIn[n.id] = 0;
  fileFanOut[n.id] = 0;
});

// === C. Fan-in/fan-out ===
fileEdges.forEach(e => {
  if (e.type === 'imports' || e.type === 'depends_on' || e.type === 'configures' || e.type === 'documents' || e.type === 'deploys' || e.type === 'migrates' || e.type === 'defines_schema' || e.type === 'triggers' || e.type === 'contains') {
    if (fileFanOut[e.source] !== undefined) fileFanOut[e.source]++;
    if (fileFanIn[e.target] !== undefined) fileFanIn[e.target]++;
  }
});

// === B. Cross-category edges ===
const crossCategoryEdges = {};
fileEdges.forEach(e => {
  const src = nodes.find(n => n.id === e.source);
  const tgt = nodes.find(n => n.id === e.target);
  if (!src || !tgt) return;
  const key = `${src.type}->${tgt.type}:${e.type}`;
  crossCategoryEdges[key] = (crossCategoryEdges[key] || 0) + 1;
});

const crossCategoryList = Object.entries(crossCategoryEdges).map(([k, count]) => {
  const [pair, edgeType] = k.split(':');
  const [fromType, toType] = pair.split('->');
  return { fromType, toType, edgeType, count };
});

// === E. Inter-group imports ===
const interGroupImports = {};
fileEdges.filter(e => e.type === 'imports').forEach(e => {
  const src = nodes.find(n => n.id === e.source);
  const tgt = nodes.find(n => n.id === e.target);
  if (!src || !tgt) return;
  const fromG = dirGroup(src.filePath);
  const toG = dirGroup(tgt.filePath);
  if (fromG === toG) return;
  const key = `${fromG}->${toG}`;
  interGroupImports[key] = (interGroupImports[key] || 0) + 1;
});
const interGroupList = Object.entries(interGroupImports)
  .map(([k, count]) => { const [from, to] = k.split('->'); return { from, to, count }; })
  .sort((a, b) => b.count - a.count);

// === F. Intra-group density ===
const intraGroupDensity = {};
const groupTotals = {};
fileEdges.filter(e => e.type === 'imports').forEach(e => {
  const src = nodes.find(n => n.id === e.source);
  const tgt = nodes.find(n => n.id === e.target);
  if (!src || !tgt) return;
  const fromG = dirGroup(src.filePath);
  const toG = dirGroup(tgt.filePath);
  [fromG, toG].forEach(g => { groupTotals[g] = (groupTotals[g] || 0) + 1; });
  if (fromG === toG) {
    intraGroupDensity[fromG] = intraGroupDensity[fromG] || { internalEdges: 0, totalEdges: 0 };
    intraGroupDensity[fromG].internalEdges++;
  }
});
Object.keys(groupTotals).forEach(g => {
  if (!intraGroupDensity[g]) intraGroupDensity[g] = { internalEdges: 0, totalEdges: 0 };
  intraGroupDensity[g].totalEdges = groupTotals[g];
  intraGroupDensity[g].density = intraGroupDensity[g].totalEdges > 0 ? intraGroupDensity[g].internalEdges / intraGroupDensity[g].totalEdges : 0;
});

// === G. Pattern matching ===
const PATTERNS = {
  'routes': 'api', 'api': 'api', 'controllers': 'api', 'endpoints': 'api', 'handlers': 'api',
  'controller': 'api', 'routers': 'api', 'serializers': 'api', 'blueprints': 'api',
  'services': 'service', 'core': 'service', 'lib': 'service', 'domain': 'service', 'logic': 'service',
  'service': 'service', 'internal': 'service', 'composables': 'service', 'mailers': 'service',
  'jobs': 'service', 'channels': 'service', 'signals': 'service', 'src/main/java': 'service',
  'src/test/java': 'test', '__tests__': 'test', 'test': 'test', 'tests': 'test', 'spec': 'test', 'specs': 'test',
  'models': 'data', 'db': 'data', 'data': 'data', 'persistence': 'data', 'repository': 'data',
  'entities': 'data', 'entity': 'data', 'migrations': 'data', 'sql': 'data', 'database': 'data',
  'schema': 'data',
  'components': 'ui', 'views': 'ui', 'pages': 'ui', 'ui': 'ui', 'layouts': 'ui', 'screens': 'ui',
  'middleware': 'middleware', 'plugins': 'middleware', 'interceptors': 'middleware', 'guards': 'middleware',
  'utils': 'utility', 'helpers': 'utility', 'common': 'utility', 'shared': 'utility', 'tools': 'utility',
  'utility': 'utility', 'pkg': 'utility', 'templatetags': 'utility',
  'config': 'config', 'constants': 'config', 'env': 'config', 'settings': 'config',
  'management': 'config', 'commands': 'config',
  'types': 'types', 'interfaces': 'types', 'schemas': 'types', 'contracts': 'types', 'dtos': 'types',
  'dto': 'types', 'request': 'types', 'response': 'types', 'vo': 'types',
  'hooks': 'hooks',
  'store': 'state', 'state': 'state', 'reducers': 'state', 'actions': 'state', 'slices': 'state',
  'assets': 'assets', 'static': 'assets', 'public': 'assets',
  'docs': 'documentation', 'documentation': 'documentation', 'wiki': 'documentation',
  'deploy': 'infrastructure', 'deployment': 'infrastructure', 'infra': 'infrastructure', 'infrastructure': 'infrastructure',
  'k8s': 'infrastructure', 'kubernetes': 'infrastructure', 'helm': 'infrastructure', 'charts': 'infrastructure',
  'terraform': 'infrastructure', 'tf': 'infrastructure', 'docker': 'infrastructure',
  '.github': 'ci-cd', '.gitlab': 'ci-cd', '.circleci': 'ci-cd',
  'bin': 'entry', 'cmd': 'entry',
};

const patternMatches = {};
Object.keys(directoryGroups).forEach(g => {
  const first = g.split('/').pop();
  if (PATTERNS[g]) patternMatches[g] = PATTERNS[g];
  else if (PATTERNS[first]) patternMatches[first] = PATTERNS[first];
});

// === H. Deployment topology ===
const allPaths = fileNodes.map(n => n.filePath || n.name || '');
const deploymentTopology = {
  hasDockerfile: allPaths.some(p => /Dockerfile/.test(p)),
  hasCompose: allPaths.some(p => /docker-compose/.test(p)),
  hasK8s: allPaths.some(p => /(^|\/)(k8s|kubernetes|helm|charts)\//.test(p)),
  hasTerraform: allPaths.some(p => /\.(tf|tfvars)$/.test(p)),
  hasCI: allPaths.some(p => /\.github\/workflows|\.gitlab-ci|Jenkinsfile/.test(p)),
  infraFiles: allPaths.filter(p => /Dockerfile|docker-compose|\.tf$|\.tfvars$|Jenkinsfile|\.github\/workflows|\.gitlab-ci/.test(p)),
};

// === I. Data pipeline ===
const dataPipeline = {
  schemaFiles: allPaths.filter(p => /\.(sql|graphql|gql|proto|prisma)$/.test(p)),
  migrationFiles: allPaths.filter(p => /migration/i.test(p) && /\.(sql|xml)$/.test(p)),
  dataModelFiles: fileNodes.filter(n => /entity|model|repository/i.test(n.filePath || '')).map(n => n.filePath),
  apiHandlerFiles: fileNodes.filter(n => /controller|endpoint|route/i.test(n.filePath || '')).map(n => n.filePath),
};

// === J. Doc coverage ===
const docCoverage = {
  groupsWithDocs: 0,
  totalGroups: 0,
  coverageRatio: 0,
  undocumentedGroups: [],
};
Object.keys(directoryGroups).forEach(g => {
  docCoverage.totalGroups++;
  const hasReadme = directoryGroups[g].some(id => {
    const n = nodes.find(nn => nn.id === id);
    return n && /README/i.test(n.name || '');
  });
  const hasDocs = directoryGroups[g].some(id => {
    const n = nodes.find(nn => nn.id === id);
    return n && n.type === 'document';
  });
  if (hasReadme || hasDocs) docCoverage.groupsWithDocs++;
  else docCoverage.undocumentedGroups.push(g);
});
docCoverage.coverageRatio = docCoverage.totalGroups > 0 ? docCoverage.groupsWithDocs / docCoverage.totalGroups : 0;

// === K. Dependency direction ===
const depMap = {};
fileEdges.filter(e => e.type === 'imports').forEach(e => {
  const src = nodes.find(n => n.id === e.source);
  const tgt = nodes.find(n => n.id === e.target);
  if (!src || !tgt) return;
  const fromG = dirGroup(src.filePath);
  const toG = dirGroup(tgt.filePath);
  if (fromG === toG) return;
  const key = `${fromG}->${toG}`;
  depMap[key] = (depMap[key] || 0) + 1;
});
const dependencyDirection = Object.entries(depMap)
  .filter(([k, v]) => v >= 2)
  .map(([k, v]) => { const [from, to] = k.split('->'); return { dependent: from, dependsOn: to, count: v }; })
  .sort((a, b) => b.count - a.count);

const fileStats = {
  totalFileNodes: fileNodes.length,
  filesPerGroup: Object.fromEntries(Object.entries(directoryGroups).map(([k, v]) => [k, v.length])),
  nodeTypeCounts: Object.fromEntries(Object.entries(nodeTypeGroups).map(([k, v]) => [k, v.length])),
};

const result = {
  scriptCompleted: true,
  directoryGroups,
  nodeTypeGroups,
  crossCategoryEdges: crossCategoryList,
  interGroupImports: interGroupList,
  intraGroupDensity,
  patternMatches,
  deploymentTopology,
  dataPipeline,
  docCoverage,
  dependencyDirection,
  fileStats,
  fileFanIn,
  fileFanOut,
};

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(`Wrote analysis to ${outputFile}`);
console.log(`File nodes: ${fileStats.totalFileNodes}`);
console.log(`Directory groups: ${Object.keys(directoryGroups).length}`);
console.log(`File edges: ${fileEdges.length}`);
