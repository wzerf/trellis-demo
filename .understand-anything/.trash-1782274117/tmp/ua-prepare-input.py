#!/usr/bin/env python3
"""Prepare the script input JSON from assembled-graph.json.

The assembled-graph stores nodes as `[{id,type,name,filePath,...}]`
and edges as `[{source,target,type,...}]`. We filter to file-level
nodes and emit three lists as expected by ua-arch-analyze.py.
"""
import json

FILE_LEVEL_TYPES = {"file", "config", "document", "service", "pipeline",
                    "table", "schema", "resource", "endpoint"}
# file-level edges are those connecting two file-level nodes
# however the assembled graph already only stores cross-file edges in
# the `edges` array (intra-file containment is folded into single nodes).

with open("/Users/wshake/code/trellis-demo/.understand-anything/intermediate/assembled-graph.json") as f:
    g = json.load(f)

nodes = g["nodes"]
edges = g["edges"]

file_nodes = []
for n in nodes:
    if n.get("type") in FILE_LEVEL_TYPES:
        file_nodes.append({
            "id": n["id"],
            "type": n["type"],
            "name": n.get("name", ""),
            "filePath": n.get("filePath", ""),
            "summary": n.get("summary", ""),
            "tags": n.get("tags", []),
        })

fl_ids = {n["id"] for n in file_nodes}
file_edges = [e for e in edges if e.get("source") in fl_ids and e.get("target") in fl_ids]
import_edges = [e for e in file_edges if e.get("type") == "imports"]

payload = {
    "fileNodes": file_nodes,
    "importEdges": import_edges,
    "allEdges": file_edges,
}

with open("/Users/wshake/code/trellis-demo/.understand-anything/tmp/ua-arch-input.json", "w") as f:
    json.dump(payload, f, ensure_ascii=False)

print(f"file_nodes={len(file_nodes)} import_edges={len(import_edges)} all_edges={len(file_edges)}")