#!/usr/bin/env python3
"""Refined structural analysis.

Same as the first pass but groups by a deeper directory (apps/...,
backend/..., packages/...) and emits a curated layer-candidate list.
"""
import json
import os
import sys
from collections import Counter, defaultdict

FILE_LEVEL_TYPES = {"file", "config", "document", "service", "pipeline",
                    "table", "schema", "resource", "endpoint"}

# Curated top-level groups for this monorepo
CURATED_GROUPS = [
    # (group_id, path prefix predicate)
    ("root", lambda p: not p.startswith(("apps/", "backend/", "packages/"))),
    ("apps/website-template", lambda p: p.startswith("apps/website-template/")),
    ("apps/backend-mock-template", lambda p: p.startswith("apps/backend-mock-template/")),
    ("apps/vue-vben-admin", lambda p: p.startswith("apps/vue-vben-admin/")),
    ("apps/react-admin", lambda p: p.startswith("apps/react-admin/")),
    ("packages/utils-template", lambda p: p.startswith("packages/utils-template/")),
    ("backend/java-admin/java-admin-api", lambda p: p.startswith("backend/java-admin/java-admin-api/")),
    ("backend/java-admin/java-admin-service", lambda p: p.startswith("backend/java-admin/java-admin-service/")),
    ("backend/java-admin/java-admin-infra", lambda p: p.startswith("backend/java-admin/java-admin-infra/")),
    ("backend/java-admin/java-admin-common", lambda p: p.startswith("backend/java-admin/java-admin-common/")),
    ("backend/java-admin/build-tools", lambda p: p.startswith("backend/java-admin/build-tools/")),
    ("backend/java-admin/deploy", lambda p: p.startswith("backend/java-admin/deploy/")),
    ("backend/java-admin", lambda p: p.startswith("backend/java-admin/") and not any(
        p.startswith(f"backend/java-admin/{x}/") for x in
        ("java-admin-api", "java-admin-service", "java-admin-infra",
         "java-admin-common", "build-tools", "deploy")
    )),
    ("backend/db/docs", lambda p: p.startswith("backend/db/docs/")),
    ("backend/db", lambda p: p.startswith("backend/db/")),
]


def main():
    inp = sys.argv[1]
    outp = sys.argv[2]
    with open(inp) as f:
        data = json.load(f)
    file_nodes = data["fileNodes"]
    import_edges = data["importEdges"]
    fl_ids = {n["id"] for n in file_nodes if n["type"] in FILE_LEVEL_TYPES}
    fl_nodes = [n for n in file_nodes if n["type"] in FILE_LEVEL_TYPES]

    # Assign curated groups
    assigned = {}
    for grp_id, pred in CURATED_GROUPS:
        for n in fl_nodes:
            if n["id"] in assigned:
                continue
            if pred(n["filePath"]):
                assigned[n["id"]] = grp_id

    # Re-check any leftover
    leftovers = [n["id"] for n in fl_nodes if n["id"] not in assigned]
    if leftovers:
        print(f"WARN leftovers: {len(leftovers)}", file=sys.stderr)
        for x in leftovers[:10]:
            print(f"   {x}", file=sys.stderr)

    # Group by curated
    groups = defaultdict(list)
    for nid, grp in assigned.items():
        groups[grp].append(nid)

    # Build adjacency restricted to file-level
    adj_out = defaultdict(set)
    for e in import_edges:
        if e["source"] in assigned and e["target"] in assigned:
            adj_out[e["source"]].add(e["target"])

    # Inter-group imports
    inter = Counter()
    for s, tgts in adj_out.items():
        for t in tgts:
            a, b = assigned[s], assigned[t]
            if a != b:
                inter[(a, b)] += 1

    inter_list = [{"from": a, "to": b, "count": c}
                  for (a, b), c in sorted(inter.items(), key=lambda x: -x[1])]

    # Intra-density
    intra = {}
    for grp, ids in groups.items():
        ids_set = set(ids)
        internal = 0
        total = 0
        for nid in ids:
            for t in adj_out.get(nid, set()):
                total += 1
                if t in ids_set:
                    internal += 1
        density = (internal / total) if total else 0.0
        intra[grp] = {"internalEdges": internal, "totalEdges": total,
                      "density": round(density, 3)}

    # Dependency direction
    dep_dir = []
    for grp_a in groups:
        for grp_b in groups:
            if grp_a == grp_b:
                continue
            a_to_b = inter.get((grp_a, grp_b), 0)
            b_to_a = inter.get((grp_b, grp_a), 0)
            if a_to_b > b_to_a:
                dep_dir.append({"dependent": grp_a, "dependsOn": grp_b,
                                "weight": a_to_b - b_to_a,
                                "aToB": a_to_b, "bToA": b_to_a})
    dep_dir.sort(key=lambda x: -x["weight"])

    # Node type counts per group
    type_per_group = {}
    for grp, ids in groups.items():
        c = Counter()
        for nid in ids:
            n = next((x for x in fl_nodes if x["id"] == nid), None)
            if n:
                c[n["type"]] += 1
        type_per_group[grp] = dict(c)

    result = {
        "scriptCompleted": True,
        "directoryGroups": {k: sorted(v) for k, v in groups.items()},
        "nodeTypeGroups": dict(Counter(n["type"] for n in fl_nodes)),
        "interGroupImports": inter_list,
        "intraGroupDensity": intra,
        "typePerGroup": type_per_group,
        "filesPerGroup": {k: len(v) for k, v in groups.items()},
        "totalFileNodes": len(fl_nodes),
        "leftovers": leftovers,
        "dependencyDirection": dep_dir,
    }
    with open(outp, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"groups={len(groups)} total={len(fl_nodes)} leftovers={len(leftovers)}")


if __name__ == "__main__":
    main()