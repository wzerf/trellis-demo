#!/usr/bin/env python3
"""Architecture analyzer - structural analysis script (Phase 1).

Reads the assembled graph and emits structural statistics that inform
the layer-assignment pass in Phase 2.
"""
import json
import os
import sys
from collections import Counter, defaultdict


FILE_LEVEL_TYPES = {"file", "config", "document", "service", "pipeline",
                    "table", "schema", "resource", "endpoint"}


def main():
    if len(sys.argv) < 3:
        print("usage: ua-arch-analyze.py <input.json> <output.json>", file=sys.stderr)
        sys.exit(1)
    inp = sys.argv[1]
    outp = sys.argv[2]

    with open(inp) as f:
        data = json.load(f)

    file_nodes = data.get("fileNodes", [])
    import_edges = data.get("importEdges", [])
    all_edges = data.get("allEdges", [])

    fl_nodes = [n for n in file_nodes if n.get("type") in FILE_LEVEL_TYPES]
    fl_ids = {n["id"] for n in fl_nodes}
    id_to_node = {n["id"]: n for n in fl_nodes}

    # ---- Directory grouping (top-level after common prefix) ----
    paths = [n["filePath"] for n in fl_nodes]
    common = os.path.commonprefix(paths) if paths else ""
    # strip down to the closest directory boundary
    if common and "/" in common:
        common = common.rsplit("/", 1)[0] + "/"

    groups = defaultdict(list)
    for n in fl_nodes:
        fp = n["filePath"]
        rest = fp[len(common):] if common else fp
        parts = rest.split("/")
        key = parts[0] if parts else "_root"
        if not key:
            key = "_root"
        groups[key].append(n["id"])

    # ---- Node type grouping ----
    type_groups = defaultdict(list)
    for n in fl_nodes:
        type_groups[n["type"]].append(n["id"])

    # ---- Import adjacency ----
    adj_out = defaultdict(set)
    adj_in = defaultdict(set)
    for e in import_edges:
        s, t = e["source"], e["target"]
        if s in fl_ids and t in fl_ids:
            adj_out[s].add(t)
            adj_in[t].add(s)

    file_fan_in = {n["id"]: len(adj_in.get(n["id"], set())) for n in fl_nodes}
    file_fan_out = {n["id"]: len(adj_out.get(n["id"], set())) for n in fl_nodes}

    # ---- Inter-group imports ----
    id_group = {}
    for grp, ids in groups.items():
        for nid in ids:
            id_group[nid] = grp

    inter = Counter()
    for e in import_edges:
        s, t = e["source"], e["target"]
        if s in id_group and t in id_group and id_group[s] != id_group[t]:
            inter[(id_group[s], id_group[t])] += 1

    inter_list = [{"from": a, "to": b, "count": c}
                  for (a, b), c in sorted(inter.items(), key=lambda x: -x[1])]

    # ---- Intra-group density ----
    intra = {}
    for grp, ids in groups.items():
        ids_set = set(ids)
        internal = 0
        total = 0
        for nid in ids:
            for t in adj_out.get(nid, set()):
                if t in fl_ids:
                    total += 1
                    if t in ids_set:
                        internal += 1
        density = (internal / total) if total else 0.0
        intra[grp] = {"internalEdges": internal, "totalEdges": total,
                      "density": round(density, 3)}

    # ---- Cross-category edge counts ----
    cat_edges = Counter()
    for e in all_edges:
        s = e.get("source", "")
        t = e.get("target", "")
        st = s.split(":", 1)[0] if ":" in s else ""
        tt = t.split(":", 1)[0] if ":" in t else ""
        if st and tt:
            cat_edges[(st, tt, e.get("type", ""))] += 1

    cross_cat = [{"fromType": s, "toType": t, "edgeType": et, "count": c}
                 for (s, t, et), c in sorted(cat_edges.items(),
                                            key=lambda x: -x[1])]

    # ---- Pattern matching ----
    patterns = {
        "api": {"routes", "api", "controllers", "endpoints", "handlers",
                "controller", "routers", "blueprints", "serializers"},
        "service": {"services", "core", "lib", "domain", "logic",
                    "internal", "composables", "signals", "mailers",
                    "jobs", "channels", "src/main/java"},
        "data": {"models", "db", "data", "persistence", "repository",
                 "entities", "entity", "migrations", "sql", "database",
                 "schema"},
        "ui": {"components", "views", "pages", "ui", "layouts", "screens"},
        "middleware": {"middleware", "plugins", "interceptors", "guards"},
        "utility": {"utils", "helpers", "common", "shared", "tools", "pkg",
                    "templatetags"},
        "config": {"config", "constants", "env", "settings",
                   "management", "commands"},
        "test": {"__tests__", "test", "tests", "spec", "specs",
                 "src/test/java"},
        "types": {"types", "interfaces", "schemas", "contracts", "dtos",
                  "dto", "request", "response"},
        "hooks": {"hooks"},
        "state": {"store", "state", "reducers", "actions", "slices"},
        "assets": {"assets", "static", "public"},
        "entry": {"cmd", "bin"},
        "documentation": {"docs", "documentation", "wiki"},
        "infrastructure": {"deploy", "deployment", "infra", "infrastructure",
                           "k8s", "kubernetes", "helm", "charts",
                           "terraform", "tf", "docker", ".github",
                           ".gitlab", ".circleci"},
    }

    pattern_matches = {}
    for grp in groups:
        l = grp.lower().lstrip(".")
        matched = None
        for pat, kws in patterns.items():
            if l in kws:
                matched = pat
                break
        pattern_matches[grp] = matched

    # ---- Deployment topology ----
    all_paths = {n["filePath"] for n in fl_nodes}
    has_dockerfile = any(p.endswith("Dockerfile") or "/Dockerfile" in p for p in all_paths)
    has_compose = any("docker-compose" in p for p in all_paths)
    has_k8s = any(any(seg in p for seg in ("/k8s/", "/kubernetes/", "/helm/", "/charts/"))
                  for p in all_paths)
    has_tf = any(p.endswith(".tf") or p.endswith(".tfvars") for p in all_paths)
    has_ci = any(any(seg in p for seg in (".github/", ".gitlab-ci", "Jenkinsfile",
                                          ".circleci/"))
                 for p in all_paths)

    infra_files = sorted([p for p in all_paths
                          if any(s in p for s in ("Dockerfile", "docker-compose",
                                                  "/deploy/", "/infra/",
                                                  ".github/", ".gitlab",
                                                  "Jenkinsfile", ".tf"))
                          or p.endswith(".tf") or p.endswith(".tfvars")])

    # ---- Data pipeline ----
    schema_files = sorted([n["filePath"] for n in fl_nodes
                           if n.get("type") == "schema"])
    # migration files = sql files outside schema.sql
    migration_files = sorted([n["filePath"] for n in fl_nodes
                              if n["filePath"].endswith(".sql")
                              and not n["filePath"].endswith("schema.sql")])
    api_handler_files = sorted([n["filePath"] for n in fl_nodes
                                if any(tag in (n.get("tags") or [])
                                       for tag in ("api-handler", "controller",
                                                   "route", "endpoint"))])

    data_model_files = sorted([n["filePath"] for n in fl_nodes
                               if "data-model" in (n.get("tags") or [])
                               or n.get("type") == "table"])

    # ---- Documentation coverage ----
    doc_ids = {n["id"] for n in fl_nodes if n["type"] == "document"}
    groups_with_docs = set()
    for n in fl_nodes:
        if n["type"] == "document":
            parts = n["filePath"].split("/")
            for k in groups.keys():
                if n["filePath"].startswith(k + "/") or n["filePath"].startswith("./" + k + "/"):
                    groups_with_docs.add(k)
                    break
            # root-level docs - associate with the closest group
    # root-level docs are not counted as 'within a group'
    coverage_ratio = (len(groups_with_docs) / len(groups)) if groups else 0

    # ---- Dependency direction ----
    dep_dir = []
    for grp_a in groups:
        for grp_b in groups:
            if grp_a == grp_b:
                continue
            a_to_b = inter.get((grp_a, grp_b), 0)
            b_to_a = inter.get((grp_b, grp_a), 0)
            if a_to_b > b_to_a and a_to_b > 0:
                dep_dir.append({"dependent": grp_a, "dependsOn": grp_b,
                                "weight": a_to_b - b_to_a})

    dep_dir.sort(key=lambda x: -x["weight"])

    # ---- File stats ----
    files_per_group = {k: len(v) for k, v in groups.items()}
    node_type_counts = {k: len(v) for k, v in type_groups.items()}

    result = {
        "scriptCompleted": True,
        "commonPrefix": common,
        "directoryGroups": {k: sorted(v) for k, v in groups.items()},
        "nodeTypeGroups": {k: sorted(v) for k, v in type_groups.items()},
        "crossCategoryEdges": cross_cat,
        "interGroupImports": inter_list,
        "intraGroupDensity": intra,
        "patternMatches": pattern_matches,
        "deploymentTopology": {
            "hasDockerfile": has_dockerfile,
            "hasCompose": has_compose,
            "hasK8s": has_k8s,
            "hasTerraform": has_tf,
            "hasCI": has_ci,
            "infraFiles": infra_files,
        },
        "dataPipeline": {
            "schemaFiles": schema_files,
            "migrationFiles": migration_files,
            "dataModelFiles": data_model_files,
            "apiHandlerFiles": api_handler_files,
        },
        "docCoverage": {
            "groupsWithDocs": len(groups_with_docs),
            "totalGroups": len(groups),
            "coverageRatio": round(coverage_ratio, 3),
            "groupsWithDocsList": sorted(groups_with_docs),
        },
        "dependencyDirection": dep_dir,
        "fileStats": {
            "totalFileNodes": len(fl_nodes),
            "filesPerGroup": files_per_group,
            "nodeTypeCounts": node_type_counts,
        },
        "fileFanIn": file_fan_in,
        "fileFanOut": file_fan_out,
    }

    with open(outp, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"wrote {outp}: {len(fl_nodes)} file-level nodes, "
          f"{len(groups)} groups, {len(import_edges)} import edges",
          file=sys.stderr)


if __name__ == "__main__":
    main()