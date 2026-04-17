import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  ArrowLeft,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import contextService from '../services/contextService';
import './KnowledgeUniverse.css';

function typeColor(type) {
  switch (type) {
    case 'hub': return 0xf4ddb9;
    case 'category': return 0xd7b38c;
    case 'concept': return 0xb89068;
    case 'wiki_page': return 0x8eb9ff;
    case 'document': return 0x8de9b8;
    case 'note': return 0xf4d26a;
    case 'flashcard_set': return 0x7ec6ff;
    case 'question_set': return 0xffb58f;
    case 'quiz_activity': return 0xf78f8f;
    case 'quiz_session': return 0xbd9bff;
    default: return 0xd7b38c;
  }
}

function hash01(seed) {
  let h = 2166136261;
  const str = String(seed || 'seed');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function fallbackCategoryId(type) {
  switch (type) {
    case 'document': return 'cat:documents';
    case 'note': return 'cat:notes';
    case 'flashcard_set': return 'cat:flashcards';
    case 'question_set': return 'cat:question_sets';
    case 'quiz_activity':
    case 'quiz_session': return 'cat:quiz_history';
    case 'wiki_page': return 'cat:wiki_pages';
    case 'concept': return 'cat:concepts';
    default: return '';
  }
}

function buildReadableLayout(nodes, edges) {
  if (!nodes?.length) return { nodes: [], edges: [] };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const positioned = new Map();

  const containsEdges = (edges || []).filter((e) => e.type === 'contains');
  const categoryToHub = new Map();
  const parentToChildren = new Map();

  containsEdges.forEach((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return;

    if (source.type === 'hub' && target.type === 'category') {
      categoryToHub.set(target.id, source.id);
    }

    if (source.type === 'category' && target.type !== 'category' && target.type !== 'hub') {
      const arr = parentToChildren.get(source.id) || [];
      arr.push(target.id);
      parentToChildren.set(source.id, arr);
    }
  });

  const setPos = (id, x, y) => {
    positioned.set(id, { x, y, z: 0 });
  };

  if (nodeById.has('hub:atlas')) {
    setPos('hub:atlas', 0, 0);
  }

  const hubs = nodes
    .filter((n) => n.type === 'hub' && n.id !== 'hub:atlas')
    .sort((a, b) => a.label.localeCompare(b.label));

  const hubRadius = 24;
  hubs.forEach((hub, idx) => {
    const theta = (idx / Math.max(1, hubs.length)) * Math.PI * 2;
    setPos(hub.id, Math.cos(theta) * hubRadius, Math.sin(theta) * hubRadius);
  });

  const categories = nodes
    .filter((n) => n.type === 'category')
    .sort((a, b) => a.label.localeCompare(b.label));

  const categoriesByHub = new Map();
  categories.forEach((cat) => {
    const hubId = categoryToHub.get(cat.id) || 'hub:atlas';
    const arr = categoriesByHub.get(hubId) || [];
    arr.push(cat);
    categoriesByHub.set(hubId, arr);
  });

  categoriesByHub.forEach((cats, hubId) => {
    const hubPos = positioned.get(hubId) || { x: 0, y: 0 };
    const localRadius = hubId === 'hub:atlas' ? 38 : 17;
    const spread = Math.min(Math.PI * 1.6, Math.PI / 3 + cats.length * 0.28);
    const base = hash01(hubId) * Math.PI * 2;

    cats.forEach((cat, idx) => {
      const t = cats.length === 1
        ? 0
        : ((idx / (cats.length - 1)) - 0.5) * spread;
      const theta = base + t;
      const jitter = (hash01(cat.id) - 0.5) * 3;
      setPos(
        cat.id,
        hubPos.x + Math.cos(theta) * localRadius + jitter,
        hubPos.y + Math.sin(theta) * localRadius + jitter,
      );
    });
  });

  const assignedChildren = new Set();
  parentToChildren.forEach((childIds, parentId) => {
    const anchor = positioned.get(parentId);
    if (!anchor) return;

    const sorted = [...childIds]
      .filter((id) => nodeById.has(id) && !assignedChildren.has(id))
      .sort((a, b) => (nodeById.get(a)?.label || '').localeCompare(nodeById.get(b)?.label || ''));

    sorted.forEach((id, idx) => {
      assignedChildren.add(id);
      const ring = Math.floor(idx / 14);
      const slot = idx % 14;
      const r = 9 + ring * 7;
      const theta = ((slot / 14) * Math.PI * 2) + (hash01(parentId) * Math.PI * 2);
      const jitter = (hash01(`${id}:j`) - 0.5) * 2.3;
      setPos(
        id,
        anchor.x + Math.cos(theta) * r + jitter,
        anchor.y + Math.sin(theta) * r + jitter,
      );
    });
  });

  const unpositioned = nodes.filter((n) => !positioned.has(n.id));
  const groupedFallback = new Map();

  unpositioned.forEach((n) => {
    const fallback = fallbackCategoryId(n.type);
    const arr = groupedFallback.get(fallback) || [];
    arr.push(n);
    groupedFallback.set(fallback, arr);
  });

  groupedFallback.forEach((group, categoryId) => {
    const anchor = positioned.get(categoryId) || positioned.get('hub:atlas') || { x: 0, y: 0 };
    group.sort((a, b) => a.label.localeCompare(b.label)).forEach((n, idx) => {
      const ring = Math.floor(idx / 10);
      const slot = idx % 10;
      const r = 12 + ring * 7;
      const theta = ((slot / 10) * Math.PI * 2) + hash01(categoryId || 'atlas') * Math.PI * 2;
      const jitter = (hash01(`${n.id}:f`) - 0.5) * 2;
      setPos(
        n.id,
        anchor.x + Math.cos(theta) * r + jitter,
        anchor.y + Math.sin(theta) * r + jitter,
      );
    });
  });

  const laidOutNodes = nodes.map((n) => {
    const pos = positioned.get(n.id) || { x: 0, y: 0, z: 0 };
    return {
      ...n,
      x: pos.x,
      y: pos.y,
      z: 0,
    };
  });

  return {
    nodes: laidOutNodes,
    edges: (edges || []).filter((e) => nodeById.has(e.source) && nodeById.has(e.target)),
  };
}

function buildAdjacency(edges) {
  const map = new Map();
  (edges || []).forEach((e) => {
    if (!map.has(e.source)) map.set(e.source, new Set());
    if (!map.has(e.target)) map.set(e.target, new Set());
    map.get(e.source).add(e.target);
    map.get(e.target).add(e.source);
  });
  return map;
}

export default function KnowledgeUniverse() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [graph, setGraph] = useState({ nodes: [], edges: [], counts: {} });
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [focusMode, setFocusMode] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);

  const counts = useMemo(() => graph?.counts || {}, [graph]);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await contextService.bootstrapWiki();
      let pagesRes = await contextService.listWikiPages({ limit: 220 });
      const sourcePages = (pagesRes.pages || []).filter((p) => p.page_type === 'source').length;
      if (sourcePages === 0) {
        await contextService.compileWiki([], { includePlatform: true });
        pagesRes = await contextService.listWikiPages({ limit: 220 });
      }
      const res = await contextService.getWikiGraph(760);
      setGraph(res || { nodes: [], edges: [], counts: {} });
    } catch (e) {
      setError(e.message || 'Failed to load knowledge universe');
    } finally {
      setLoading(false);
    }
  }, []);

  const rebuildAndRefresh = useCallback(async () => {
    setRebuilding(true);
    setError('');
    try {
      await contextService.compileWiki([], { includePlatform: true });
      const res = await contextService.getWikiGraph(760);
      setGraph(res || { nodes: [], edges: [], counts: {} });
    } catch (e) {
      setError(e.message || 'Failed to rebuild universe');
    } finally {
      setRebuilding(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const enrichedGraph = useMemo(() => {
    const degree = new Map();
    (graph.edges || []).forEach((e) => {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    });
    return {
      nodes: (graph.nodes || []).map((n) => ({ ...n, degree: degree.get(n.id) || 0 })),
      edges: graph.edges || [],
    };
  }, [graph]);

  const laidOutGraph = useMemo(
    () => buildReadableLayout(enrichedGraph.nodes, enrichedGraph.edges),
    [enrichedGraph],
  );

  const adjacency = useMemo(() => buildAdjacency(laidOutGraph.edges), [laidOutGraph.edges]);
  const nodeById = useMemo(
    () => new Map((laidOutGraph.nodes || []).map((n) => [n.id, n])),
    [laidOutGraph.nodes],
  );

  const typeOptions = useMemo(() => {
    const set = new Set((laidOutGraph.nodes || []).map((n) => n.type));
    return ['all', ...Array.from(set).sort()];
  }, [laidOutGraph.nodes]);

  const selectedNode = selectedNodeId ? (nodeById.get(selectedNodeId) || null) : null;

  const displayGraph = useMemo(() => {
    const q = query.trim().toLowerCase();
    const baseVisible = new Set(
      laidOutGraph.nodes
        .filter((n) => {
          if (typeFilter !== 'all' && n.type !== typeFilter) return false;
          if (!q) return true;
          return n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
        })
        .map((n) => n.id),
    );

    if (selectedNodeId && focusMode && nodeById.has(selectedNodeId)) {
      const around = new Set([selectedNodeId, 'hub:atlas']);
      (adjacency.get(selectedNodeId) || []).forEach((nid) => around.add(nid));
      (adjacency.get('hub:atlas') || []).forEach((nid) => {
        if (nid.startsWith('hub:') || nid.startsWith('cat:')) around.add(nid);
      });

      around.forEach((id) => {
        if (nodeById.has(id)) baseVisible.add(id);
      });

      for (const id of Array.from(baseVisible)) {
        if (!around.has(id)) baseVisible.delete(id);
      }
    }

    const nodes = laidOutGraph.nodes.filter((n) => baseVisible.has(n.id));
    const visibleIds = new Set(nodes.map((n) => n.id));
    const edges = laidOutGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

    return {
      nodes,
      edges,
      hiddenNodes: Math.max(0, laidOutGraph.nodes.length - nodes.length),
    };
  }, [laidOutGraph, query, typeFilter, focusMode, selectedNodeId, adjacency, nodeById]);

  useEffect(() => {
    if (selectedNodeId && !nodeById.has(selectedNodeId)) {
      setSelectedNodeId('');
    }
  }, [selectedNodeId, nodeById]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return [];
    const neighbors = Array.from(adjacency.get(selectedNodeId) || []);
    return neighbors
      .map((id) => nodeById.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.degree !== a.degree) return b.degree - a.degree;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 14);
  }, [selectedNodeId, adjacency, nodeById]);

  useEffect(() => {
    if (loading || !displayGraph?.nodes?.length) return;
    const container = canvasRef.current;
    if (!container) return;

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 620;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x05050a, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(
      width / -16,
      width / 16,
      height / 16,
      height / -16,
      0.1,
      2000,
    );
    camera.position.set(0, 0, 120);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 0.95;
    controls.panSpeed = 0.8;
    controls.minZoom = 0.35;
    controls.maxZoom = 4.8;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    const grid = new THREE.GridHelper(300, 30, 0x2d2b34, 0x17131f);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.5;
    scene.add(grid);

    const edgeGroup = new THREE.Group();
    scene.add(edgeGroup);

    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    const meshById = {};
    const visibleNodeById = new Map(displayGraph.nodes.map((n) => [n.id, n]));

    displayGraph.edges.forEach((edge) => {
      const source = visibleNodeById.get(edge.source);
      const target = visibleNodeById.get(edge.target);
      if (!source || !target) return;

      const points = [
        new THREE.Vector3(source.x, source.y, 0),
        new THREE.Vector3(target.x, target.y, 0),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: edge.type === 'contains' ? 0x8a7a64 : 0x5a647f,
        transparent: true,
        opacity: edge.type === 'contains' ? 0.38 : 0.24,
      });
      const line = new THREE.Line(geometry, material);
      line.userData = { edge };
      edgeGroup.add(line);
    });

    displayGraph.nodes.forEach((node) => {
      const size = Math.max(0.5, Math.min(2.6, Number(node.size || 1))) * 0.72;
      const geometry = new THREE.CircleGeometry(size, 24);
      const color = typeColor(node.type);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Number(node.x || 0), Number(node.y || 0), 0.5);
      mesh.userData = { node };
      nodeGroup.add(mesh);
      meshById[node.id] = mesh;
    });

    const setMeshStyle = (mesh, style) => {
      if (!mesh || !mesh.material) return;
      mesh.material.opacity = style.opacity;
      mesh.scale.set(style.scale, style.scale, 1);
      mesh.material.color.setHex(style.color);
    };

    const defaultStyle = (node) => ({
      opacity: 0.92,
      scale: 1,
      color: typeColor(node.type),
    });

    const selectedStyle = (node) => ({
      opacity: 1,
      scale: 1.45,
      color: node.type === 'hub' ? 0xffe7c7 : 0xffe7bf,
    });

    const hoveredStyle = (node) => ({
      opacity: 1,
      scale: 1.22,
      color: node.type === 'hub' ? 0xffe7c7 : 0xffe1b3,
    });

    Object.values(meshById).forEach((mesh) => {
      setMeshStyle(mesh, defaultStyle(mesh.userData.node));
    });

    if (selectedNodeId && meshById[selectedNodeId]) {
      setMeshStyle(meshById[selectedNodeId], selectedStyle(meshById[selectedNodeId].userData.node));
      const pos = meshById[selectedNodeId].position;
      controls.target.set(pos.x, pos.y, 0);
      camera.position.set(pos.x, pos.y, 120);
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh = null;
    let selectedMesh = selectedNodeId ? meshById[selectedNodeId] : null;
    let downPoint = null;

    const hitTest = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(Object.values(meshById));
      return { hits, rect };
    };

    const onPointerMove = (e) => {
      const { hits, rect } = hitTest(e);
      const hit = hits[0]?.object || null;

      if (hoveredMesh && hoveredMesh !== selectedMesh && hoveredMesh !== hit) {
        setMeshStyle(hoveredMesh, defaultStyle(hoveredMesh.userData.node));
      }

      if (hit) {
        hoveredMesh = hit;
        if (hoveredMesh !== selectedMesh) {
          setMeshStyle(hoveredMesh, hoveredStyle(hoveredMesh.userData.node));
        }

        const node = hoveredMesh.userData.node;
        const nx = Math.min(Math.max(e.clientX - rect.left + 14, 10), rect.width - 200);
        const ny = Math.min(Math.max(e.clientY - rect.top + 14, 10), rect.height - 90);
        setHoverInfo({
          x: nx,
          y: ny,
          label: node.label,
          type: node.type,
          degree: node.degree || 0,
        });
      } else {
        hoveredMesh = null;
        setHoverInfo(null);
      }
    };

    const onPointerLeave = () => {
      if (hoveredMesh && hoveredMesh !== selectedMesh) {
        setMeshStyle(hoveredMesh, defaultStyle(hoveredMesh.userData.node));
      }
      hoveredMesh = null;
      setHoverInfo(null);
    };

    const onPointerDown = (e) => {
      downPoint = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
      if (!downPoint) return;
      const dist = Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y);
      downPoint = null;
      if (dist > 5) return;

      const { hits } = hitTest(e);
      if (!hits.length) return;

      const hit = hits[0].object;
      if (selectedMesh && selectedMesh !== hit) {
        setMeshStyle(selectedMesh, defaultStyle(selectedMesh.userData.node));
      }

      selectedMesh = hit;
      setMeshStyle(selectedMesh, selectedStyle(selectedMesh.userData.node));
      setSelectedNodeId(selectedMesh.userData?.node?.id || '');
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.left = w / -16;
      camera.right = w / 16;
      camera.top = h / 16;
      camera.bottom = h / -16;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      container.innerHTML = '';
      setHoverInfo(null);
    };
  }, [displayGraph, loading, selectedNodeId]);

  return (
    <div className="ku-root">
      <header className="ku-header">
        <button className="ku-btn ku-btn-ghost" onClick={() => navigate('/search-hub')}>
          <ArrowLeft size={14} /> Back to Atlas
        </button>
        <div className="ku-title-wrap">
          <h1 className="ku-title">Knowledge Universe</h1>
          <p className="ku-sub">Wiki-first map of everything connected across Vault, Oracle, and Archive</p>
        </div>
        <div className="ku-actions">
          <button className="ku-btn ku-btn-ghost" onClick={loadGraph} disabled={loading}>
            {loading ? <Loader2 size={13} className="ku-spin" /> : <RefreshCw size={13} />} Refresh
          </button>
          <button className="ku-btn ku-btn-accent" onClick={rebuildAndRefresh} disabled={rebuilding}>
            {rebuilding ? <Loader2 size={13} className="ku-spin" /> : <Wand2 size={13} />} Rebuild Graph
          </button>
        </div>
      </header>

      {error && (
        <div className="ku-error">{error}</div>
      )}

      <div className="ku-body">
        <div className="ku-canvas-wrap" ref={canvasRef}>
          {(loading || rebuilding) && (
            <div className="ku-overlay-loading">
              <Loader2 size={16} className="ku-spin" /> Building universe...
            </div>
          )}

          {!loading && !displayGraph.nodes.length && (
            <div className="ku-overlay-empty">No nodes match current filters.</div>
          )}

          {hoverInfo && (
            <div className="ku-tooltip" style={{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }}>
              <div className="ku-tooltip-title">{hoverInfo.label}</div>
              <div className="ku-tooltip-meta">{hoverInfo.type} • {hoverInfo.degree} links</div>
            </div>
          )}
        </div>

        <aside className="ku-side">
          <div className="ku-side-block">
            <div className="ku-side-label">Explorer</div>
            <label className="ku-field">
              <span><Search size={12} /> Search nodes</span>
              <input
                type="text"
                className="ku-input"
                placeholder="Search concept, note, source..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="ku-field">
              <span>Type filter</span>
              <select className="ku-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === 'all' ? 'all types' : opt}</option>
                ))}
              </select>
            </label>
            <label className="ku-check">
              <input
                type="checkbox"
                checked={focusMode}
                onChange={(e) => setFocusMode(e.target.checked)}
              />
              <span>Focus mode (selected node + neighbors)</span>
            </label>
            {displayGraph.hiddenNodes > 0 && (
              <div className="ku-hint">{displayGraph.hiddenNodes} nodes hidden by current view</div>
            )}
          </div>

          <div className="ku-side-block">
            <div className="ku-side-label">Graph Stats</div>
            <div className="ku-stats-grid">
              <span><Network size={12} /> Nodes: {counts.nodes || 0}</span>
              <span>Visible: {displayGraph.nodes.length}</span>
              <span>Edges: {counts.edges || 0}</span>
              <span>Documents: {counts.documents || 0}</span>
              <span>Notes: {counts.notes || 0}</span>
              <span>Flashcard Sets: {counts.flashcard_sets || 0}</span>
              <span>Question Sets: {counts.question_sets || 0}</span>
              <span>Quiz History: {counts.activities || 0}</span>
              <span>Wiki Pages: {counts.wiki_pages || 0}</span>
            </div>
          </div>

          <div className="ku-side-block">
            <div className="ku-side-label">Selected Node</div>
            {selectedNode ? (
              <div className="ku-node-card">
                <div className="ku-node-title">{selectedNode.label}</div>
                <div className="ku-node-meta">Type: {selectedNode.type}</div>
                <div className="ku-node-meta">ID: {selectedNode.id}</div>
                <div className="ku-node-meta">Links: {selectedNode.degree || 0}</div>

                {!!selectedNeighbors.length && (
                  <div className="ku-neighbors">
                    <div className="ku-side-label">Connected To</div>
                    <div className="ku-neighbor-list">
                      {selectedNeighbors.map((node) => (
                        <button
                          key={node.id}
                          className="ku-neighbor-chip"
                          onClick={() => setSelectedNodeId(node.id)}
                          type="button"
                        >
                          {node.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ku-empty">Hover a node to preview. Click a node to inspect it.</div>
            )}
          </div>

          <div className="ku-side-block">
            <div className="ku-side-label">Controls</div>
            <div className="ku-help">
              <span>Hover: see label + type</span>
              <span>Click: inspect + focus</span>
              <span>Drag: pan map</span>
              <span>Wheel/Pinch: zoom</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
