import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  Send, Upload, FileText, Brain, X, Loader2, AlertCircle,
  CheckCircle, Trash2, RefreshCw, ArrowRight, Plus,
  Search, Menu, Tag, ChevronLeft
} from 'lucide-react';
import { API_URL } from '../config/api';
import contextService from '../services/contextService';
import './Atlas.css';

// ── GLSL shaders ──────────────────────────────────────────────────────────────
const PLANET_VERT = `
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  varying float vElevation;
  void main() {
    vUv       = uv;
    vNormal   = normalize(normalMatrix * normal);
    vec4 mv   = modelViewMatrix * vec4(position, 1.0);
    vViewDir  = normalize(-mv.xyz);
    vElevation= position.y;
    gl_Position = projectionMatrix * mv;
  }
`;

const PLANET_FRAG = `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uTime;
  uniform float uZoom;

  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  varying float vElevation;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.1; a*=0.48; }
    return v;
  }

  void main() {
    vec3 L   = normalize(vec3(4.0, 6.0, 5.0));
    float d  = max(dot(vNormal, L), 0.0);
    float lit = 0.15 + 0.85 * d;

    float t  = uTime * 0.01;
    float n1 = fbm(vUv * 4.0  + vec2( t,  t*0.7));
    float n2 = fbm(vUv * 9.0  - vec2( t*0.6, -t*0.4));
    float n3 = noise(vUv * 18.0 + vec2(-t*0.3, t*0.5));
    float pat = n1*0.50 + n2*0.32 + n3*0.18;

    vec3 col  = mix(uColorA, uColorB, pat*0.60 + vUv.y*0.30);
    col      *= lit;

    float rim = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);
    col += uColorB * rim * (0.70 + uZoom * 0.60);

    float spec = pow(max(dot(reflect(-L, vNormal), vViewDir), 0.0), 28.0);
    col += vec3(spec) * 0.25;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMO_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal  = normalize(normalMatrix * normal);
    vec4 mv  = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = `
  uniform vec3  uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float r = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), uPower);
    gl_FragColor = vec4(uColor, r * uIntensity);
  }
`;

// ── Gold palette (normalised RGB) ─────────────────────────────────────────────
const G_MAIN  = [0.843, 0.702, 0.549]; // #D7B38C  warm gold
const G_LIGHT = [0.929, 0.835, 0.690]; // #EDD5B0  light gold
const G_DEEP  = [0.478, 0.329, 0.208]; // #7A5435  dark gold
const G_DIM   = [0.722, 0.565, 0.408]; // #B89068  mid gold
const G_PALE  = [0.961, 0.918, 0.835]; // #F5EAD5  near-white gold

// Three.js hex equivalents
const HEX_MAIN   = 0xD7B38C;
const HEX_LIGHT  = 0xEDD5B0;
const HEX_DEEP   = 0x7A5435;
const HEX_BG     = 0x0A0806;

const ORBIT_CENTER = new THREE.Vector3(0, 0, -9);
const HOME_CAM     = new THREE.Vector3(0, 1.5, 14);
const HOME_LOOK    = new THREE.Vector3(0, 0, -9);

const WORLDS = [
  {
    key: 'oracle',  label: 'ORACLE',  sub: 'ASK ANYTHING',
    colorA: G_MAIN,  colorB: G_LIGHT,
    atmoColor: G_MAIN, atmoScale: 1.45, atmoIntensity: 0.70,
    radius: 1.32, orbitR: 5.2, orbitSpeed: 0.18, orbitTiltX: 0.22, orbitTiltZ: 0.08,
    hasRing: false,
  },
  {
    key: 'archive', label: 'ARCHIVE', sub: 'CURRICULUM',
    colorA: G_DEEP,  colorB: G_DIM,
    atmoColor: G_DIM,  atmoScale: 1.40, atmoIntensity: 0.60,
    radius: 1.84, orbitR: 8.2, orbitSpeed: 0.16, orbitTiltX: -0.20, orbitTiltZ: 0.15,
    hasRing: true,
  },
  {
    key: 'vault',   label: 'VAULT',   sub: 'MY DOCUMENTS',
    colorA: G_DIM,   colorB: G_PALE,
    atmoColor: G_LIGHT, atmoScale: 1.50, atmoIntensity: 0.75,
    radius: 1.04, orbitR: 11.5, orbitSpeed: 0.20, orbitTiltX: 0.40, orbitTiltZ: -0.12,
    hasRing: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' }); }
  catch { return ''; }
}
function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n/1024).toFixed(0)}KB`;
  return `${(n/1048576).toFixed(1)}MB`;
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({ open, onClose, onDone }) {
  const [file, setFile]       = useState(null);
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [drag, setDrag]       = useState(false);
  const inputRef              = useRef();

  useEffect(() => { if (open) { setFile(null); setError(''); setSuccess(false); } }, [open]);

  const submit = async () => {
    if (!file) { setError('Choose a file first.'); return; }
    setLoading(true); setError('');
    try {
      await contextService.uploadDocument(file, subject, '', 'private');
      setSuccess(true);
      if (onDone) onDone();
      setTimeout(onClose, 1400);
    } catch (e) { setError(e.message || 'Upload failed'); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div className="atl-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="atl-modal">
        <div className="atl-modal-hd">
          <span>UPLOAD TO VAULT</span>
          <button className="atl-modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        {success ? (
          <div className="atl-modal-success"><CheckCircle size={36}/><p>ADDED TO YOUR VAULT</p></div>
        ) : (
          <>
            <div
              className={`atl-drop-zone${drag?' atl-drop-zone--over':''}${file?' atl-drop-zone--has':''}`}
              onDragOver={e=>{e.preventDefault();setDrag(true);}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)setFile(f);}}
              onClick={()=>inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".pdf,.txt,.md" style={{display:'none'}} onChange={e=>setFile(e.target.files[0])}/>
              {file ? (
                <div className="atl-drop-file">
                  <FileText size={22}/><span>{file.name}</span>
                  <span className="atl-drop-size">{fmtBytes(file.size)}</span>
                  <button onClick={e=>{e.stopPropagation();setFile(null);}}><X size={12}/></button>
                </div>
              ) : (
                <><Upload size={28} className="atl-drop-icon"/><p>DROP PDF, TXT, OR MD</p><span>OR CLICK TO BROWSE</span></>
              )}
            </div>
            <input className="atl-modal-subject" placeholder="SUBJECT (OPTIONAL)" value={subject} onChange={e=>setSubject(e.target.value)}/>
            {error && <div className="atl-modal-err"><AlertCircle size={13}/>{error}</div>}
            <div className="atl-modal-actions">
              <button className="atl-btn atl-btn--ghost" onClick={onClose}>CANCEL</button>
              <button className="atl-btn atl-btn--accent" onClick={submit} disabled={loading||!file}>
                {loading?<Loader2 size={14} className="atl-spin"/>:<Upload size={14}/>}
                {loading?'UPLOADING':'UPLOAD'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Atlas() {
  const canvasRef      = useRef(null);
  const threeRef       = useRef({});
  const labelRefs      = useRef([]);
  const rafRef         = useRef(null);
  const activeWorldRef = useRef(null);

  const [activeWorld, setActiveWorld] = useState(null);
  const [userDocs,    setUserDocs]    = useState([]);
  const [hsSubjects,  setHsSubjects]  = useState([]);
  const [hsStats,     setHsStats]     = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [askHistory,  setAskHistory]  = useState([]);
  const [askInput,    setAskInput]    = useState('');
  const [askLoading,  setAskLoading]  = useState(false);
  const [askUseHs,    setAskUseHs]    = useState(true);
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [archiveSearch,setArchiveSearch]=useState('');
  const oracleEndRef   = useRef(null);

  // ── Three.js ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const W = container.clientWidth, H = container.clientHeight;

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(HEX_BG, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(HEX_BG, 0.007);

    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 800);
    camera.position.copy(HOME_CAM);
    camera.lookAt(HOME_LOOK);

    const clock = new THREE.Clock();

    // lights
    scene.add(new THREE.AmbientLight(HEX_LIGHT, 0.10));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(12, 18, 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight(HEX_MAIN, 0.35);
    fill.position.set(-8, -5, -5);
    scene.add(fill);

    // stars (warm tint)
    const starArr = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      starArr[i*3]   = (Math.random()-0.5)*600;
      starArr[i*3+1] = (Math.random()-0.5)*600;
      starArr[i*3+2] = (Math.random()-0.5)*600;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starArr, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: HEX_LIGHT, size: 0.20, sizeAttenuation: true, transparent: true, opacity: 0.55,
    })));

    // large background icosahedron wireframe
    const bgEdge = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(80, 3));
    const bgMesh = new THREE.LineSegments(bgEdge, new THREE.LineBasicMaterial({
      color: HEX_MAIN, transparent: true, opacity: 0.028,
    }));
    scene.add(bgMesh);

    // background random network (node graph)
    const netNodes = Array.from({length:50}, () =>
      new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*60, -30-Math.random()*40)
    );
    const netVerts = [];
    for (let i = 0; i < netNodes.length; i++)
      for (let j = i+1; j < netNodes.length; j++)
        if (netNodes[i].distanceTo(netNodes[j]) < 22)
          netVerts.push(netNodes[i].x,netNodes[i].y,netNodes[i].z, netNodes[j].x,netNodes[j].y,netNodes[j].z);
    const netGeo = new THREE.BufferGeometry();
    netGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(netVerts), 3));
    scene.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({
      color: HEX_MAIN, transparent: true, opacity: 0.08,
    })));

    // orbit center sun
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshBasicMaterial({ color: HEX_LIGHT })
    );
    sunMesh.position.copy(ORBIT_CENTER);
    scene.add(sunMesh);
    const sunAtmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
      uniforms: {
        uColor:     { value: new THREE.Color(HEX_MAIN) },
        uPower:     { value: 1.4 },
        uIntensity: { value: 0.45 },
      },
      transparent: true, side: THREE.FrontSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    sunMesh.add(new THREE.Mesh(new THREE.SphereGeometry(2.8, 32, 32), sunAtmoMat));

    // dynamic connection lines between planets
    const connPos = new Float32Array(18);
    const connGeo = new THREE.BufferGeometry();
    connGeo.setAttribute('position', new THREE.BufferAttribute(connPos, 3));
    scene.add(new THREE.LineSegments(connGeo, new THREE.LineBasicMaterial({
      color: HEX_MAIN, transparent: true, opacity: 0.09, depthWrite: false,
    })));

    // ── Build planets ─────────────────────────────────────────────────────
    const planets = [];

    WORLDS.forEach((w, wi) => {
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.x = w.orbitTiltX;
      tiltGroup.rotation.z = w.orbitTiltZ;
      tiltGroup.position.copy(ORBIT_CENTER);
      scene.add(tiltGroup);

      // orbit path ring
      const orbitPts = new Float32Array(129 * 3);
      for (let k = 0; k <= 128; k++) {
        const a = (k/128)*Math.PI*2;
        orbitPts[k*3]   = Math.cos(a) * w.orbitR;
        orbitPts[k*3+1] = 0;
        orbitPts[k*3+2] = Math.sin(a) * w.orbitR;
      }
      const orbitGeo = new THREE.BufferGeometry();
      orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPts, 3));
      tiltGroup.add(new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({
        color: HEX_MAIN, transparent: true, opacity: 0.16,
      })));

      const group = new THREE.Group();
      tiltGroup.add(group);

      // solid planet (ShaderMaterial — noise surface + fresnel rim + specular)
      const sMat = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        uniforms: {
          uColorA: { value: new THREE.Vector3(...w.colorA) },
          uColorB: { value: new THREE.Vector3(...w.colorB) },
          uTime:   { value: 0.0 },
          uZoom:   { value: 0.0 },
        },
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(w.radius, 64, 64), sMat);
      group.add(mesh);

      // geodesic wireframe — high detail, normally subtle
      const geoIco   = new THREE.IcosahedronGeometry(w.radius * 1.006, 4);
      const wfEdgeHi = new THREE.EdgesGeometry(geoIco);
      const wfHi     = new THREE.LineSegments(wfEdgeHi, new THREE.LineBasicMaterial({
        color: HEX_LIGHT, transparent: true, opacity: 0.06, depthWrite: false,
      }));
      group.add(wfHi);

      // low-detail outer lattice — more visible, slower counter-rotation
      const geoLo   = new THREE.SphereGeometry(w.radius * 1.016, 14, 10);
      const wfEdgeLo = new THREE.EdgesGeometry(geoLo);
      const wfLo     = new THREE.LineSegments(wfEdgeLo, new THREE.LineBasicMaterial({
        color: HEX_MAIN, transparent: true, opacity: 0.18, depthWrite: false,
      }));
      group.add(wfLo);

      // extra inner icosahedron — only visible when zoomed in
      const geoInner   = new THREE.IcosahedronGeometry(w.radius * 0.82, 2);
      const wfEdgeInner = new THREE.EdgesGeometry(geoInner);
      const wfInner     = new THREE.LineSegments(wfEdgeInner, new THREE.LineBasicMaterial({
        color: HEX_DEEP, transparent: true, opacity: 0.0, depthWrite: false,
      }));
      group.add(wfInner);

      // atmosphere (Fresnel, additive)
      const atmoMat = new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
        uniforms: {
          uColor:     { value: new THREE.Vector3(...w.atmoColor) },
          uPower:     { value: 2.0 },
          uIntensity: { value: w.atmoIntensity },
        },
        transparent: true, side: THREE.FrontSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(w.radius * w.atmoScale, 32, 32), atmoMat));

      // outer halo ring (large, very transparent) — extra atmosphere layer
      const haloMat = new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
        uniforms: {
          uColor:     { value: new THREE.Vector3(...w.colorB) },
          uPower:     { value: 1.2 },
          uIntensity: { value: 0.15 },
        },
        transparent: true, side: THREE.FrontSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(w.radius * 2.2, 32, 32), haloMat));

      // Saturn ring (Archive)
      if (w.hasRing) {
        const rIn = w.radius * 1.75, rOut = w.radius * 2.65;
        const rGeo = new THREE.RingGeometry(rIn, rOut, 128, 3);
        const rMat = new THREE.MeshBasicMaterial({
          color: HEX_LIGHT, transparent: true, opacity: 0.18,
          side: THREE.DoubleSide, depthWrite: false,
        });
        const ring = new THREE.Mesh(rGeo, rMat);
        ring.rotation.x = Math.PI * 0.5 + 0.28;
        ring.rotation.z = 0.18;
        group.add(ring);

        const rWfEdge = new THREE.EdgesGeometry(new THREE.RingGeometry(rIn, rOut, 48, 2));
        const rWf = new THREE.LineSegments(rWfEdge, new THREE.LineBasicMaterial({
          color: HEX_MAIN, transparent: true, opacity: 0.25,
        }));
        rWf.rotation.x = ring.rotation.x;
        rWf.rotation.z = ring.rotation.z;
        group.add(rWf);
      }

      // point light
      const pLight = new THREE.PointLight(HEX_MAIN, 0.7, 28);
      group.add(pLight);

      planets.push({
        w, tiltGroup, group, mesh, sMat, wfHi, wfLo, wfInner, atmoMat,
        angle: wi * (Math.PI * 2 / 3),
        bounceT: -1,
        bounceDur: 1.4,
      });
    });

    // raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const meshes = planets.map(p => p.mesh);

    const onClick = e => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const pd = planets.find(p => p.mesh === hits[0].object);
        if (pd) {
          pd.bounceT = 0;
          setActiveWorld(prev => prev === pd.w.key ? null : pd.w.key);
        }
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    const onResize = () => {
      const nW = container.clientWidth, nH = container.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    // camera animation state
    const camTarget  = { pos: HOME_CAM.clone(), look: HOME_LOOK.clone() };
    const camCurrent = { pos: HOME_CAM.clone(), look: HOME_LOOK.clone() };

    threeRef.current = {
      renderer, scene, camera, planets, meshes,
      camTarget, camCurrent, connPos, connGeo, sunAtmoMat, bgMesh,
    };

    // ── Animation loop ────────────────────────────────────────────────────
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const delta   = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();

      bgMesh.rotation.y = elapsed * 0.012;
      bgMesh.rotation.x = elapsed * 0.006;
      sunAtmoMat.uniforms.uIntensity.value = 0.40 + Math.sin(elapsed * 1.6) * 0.18;

      // Per-planet update
      const worldPositions = [];
      const activeKey = activeWorldRef.current;

      planets.forEach((pd, i) => {
        pd.angle += pd.w.orbitSpeed * delta * 0.5;
        const ox = Math.cos(pd.angle) * pd.w.orbitR;
        const oz = Math.sin(pd.angle) * pd.w.orbitR;
        pd.group.position.set(ox, 0, oz);

        // Bounce: surge toward camera then back
        if (pd.bounceT >= 0) {
          pd.bounceT += delta;
          const bt = Math.min(pd.bounceT / pd.bounceDur, 1.0);
          const surge = Math.sin(bt * Math.PI);

          pd.tiltGroup.updateWorldMatrix(true, false);
          pd.group.updateWorldMatrix(true, false);
          const worldPos = new THREE.Vector3();
          pd.group.getWorldPosition(worldPos);
          const towardCam = camera.position.clone().sub(worldPos).normalize();
          const invQuat   = pd.tiltGroup.quaternion.clone().invert();
          towardCam.applyQuaternion(invQuat);
          pd.group.position.addScaledVector(towardCam, surge * 5.0);

          if (bt >= 1.0) {
            pd.bounceT = -1;
            pd.group.position.set(ox, 0, oz);
          }
        } else {
          pd.group.scale.setScalar(1.0);
        }

        // Axial self-rotation
        pd.mesh.rotation.y  = elapsed * (0.55 + i * 0.18);
        pd.mesh.rotation.x  = Math.sin(elapsed * 0.22 + i * 1.1) * 0.07;
        pd.wfHi.rotation.y  = elapsed * (0.20 + i * 0.09);
        pd.wfHi.rotation.x  = elapsed * 0.11;
        pd.wfLo.rotation.y  = -elapsed * (0.13 + i * 0.06);
        pd.wfLo.rotation.z  = elapsed * 0.04;
        pd.wfInner.rotation.y = elapsed * (0.35 + i * 0.12);
        pd.wfInner.rotation.z = elapsed * (0.18 + i * 0.07);

        pd.sMat.uniforms.uTime.value = elapsed;

        // Compute current world position
        const wp = new THREE.Vector3();
        pd.group.getWorldPosition(wp);
        worldPositions.push(wp);

        // How close is camera to this planet (0=far, 1=fully zoomed)
        const dist   = camera.position.distanceTo(wp);
        const close  = Math.max(0, Math.min(1, 1.0 - (dist - 2.5) / 9.0));
        const isThis = activeKey === pd.w.key;

        // Wireframe opacity scales up dramatically on zoom
        pd.wfHi.material.opacity    = 0.06 + close * 0.58;
        pd.wfLo.material.opacity    = 0.18 + close * 0.62;
        pd.wfInner.material.opacity = close * 0.50;

        // Planet shader zoom uniform — brightens rim
        pd.sMat.uniforms.uZoom.value = close;

        // Atmosphere pulses more intensely when zoomed
        pd.atmoMat.uniforms.uIntensity.value =
          pd.w.atmoIntensity * (1.0 + close * 1.8) + Math.sin(elapsed * 1.3 + i * 2.1) * 0.10;
      });

      // Update connection lines
      [[0,1],[1,2],[0,2]].forEach(([a,b], i) => {
        const A = worldPositions[a], B = worldPositions[b];
        connPos[i*6]   = A.x; connPos[i*6+1] = A.y; connPos[i*6+2] = A.z;
        connPos[i*6+3] = B.x; connPos[i*6+4] = B.y; connPos[i*6+5] = B.z;
      });
      connGeo.attributes.position.needsUpdate = true;

      // Camera target: home or zoom-track selected planet
      if (activeKey === null) {
        camTarget.pos.copy(HOME_CAM);
        camTarget.look.copy(HOME_LOOK);
      } else {
        const idx = planets.findIndex(p => p.w.key === activeKey);
        if (idx >= 0 && worldPositions[idx]) {
          const wp = worldPositions[idx];
          const pd = planets[idx];
          // Position camera close to planet on the home-facing side
          const zoomDist = pd.w.radius * 3.2 + 1.0;
          const toHome   = HOME_CAM.clone().sub(wp).normalize();
          camTarget.pos.copy(wp).addScaledVector(toHome, zoomDist);
          camTarget.look.copy(wp);
        }
      }

      camCurrent.pos.lerp(camTarget.pos, 0.038);
      camCurrent.look.lerp(camTarget.look, 0.038);
      camera.position.copy(camCurrent.pos);
      camera.lookAt(camCurrent.look);

      // Idle sway in home view
      if (activeKey === null) {
        camera.position.x += Math.sin(elapsed * 0.10) * 0.50;
        camera.position.y += Math.sin(elapsed * 0.07) * 0.24;
      }

      // Label positions
      const cW = container.clientWidth, cH = container.clientHeight;
      const isHome = activeKey === null;
      labelRefs.current.forEach((el, i) => {
        if (!el || !worldPositions[i]) return;
        const v = worldPositions[i].clone().project(camera);
        el.style.left         = `${(v.x + 1) / 2 * cW}px`;
        el.style.top          = `${-(v.y - 1) / 2 * cH}px`;
        el.style.opacity      = isHome ? '1' : '0';
        el.style.pointerEvents = isHome ? 'auto' : 'none';
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { activeWorldRef.current = activeWorld; }, [activeWorld]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setDataLoading(true);
    try {
      const [docs, subs, stats] = await Promise.allSettled([
        contextService.listDocuments(),
        contextService.getHsSubjects(),
        fetch(`${API_URL}/context/hs/stats`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then(r => r.ok ? r.json() : {}),
      ]);
      if (docs.status  === 'fulfilled') { const d = docs.value; setUserDocs(Array.isArray(d) ? d : (d.user_docs||[])); }
      if (subs.status  === 'fulfilled') setHsSubjects(subs.value.subjects||[]);
      if (stats.status === 'fulfilled') setHsStats(stats.value);
    } catch { /* silenced */ }
    finally { setDataLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (oracleEndRef.current) oracleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [askHistory]);

  const handleAsk = useCallback(async (q) => {
    const question = (q || askInput).trim();
    if (!question || askLoading) return;
    setAskInput('');
    setAskHistory(prev => [...prev, { question, answer: null, sources: [], loading: true }]);
    setAskLoading(true);
    try {
      const res = await contextService.askKnowledgeBase(question, { useHs: askUseHs, topK: 6 });
      setAskHistory(prev => { const n=[...prev]; n[n.length-1]={question,answer:res.answer,sources:res.sources||[],loading:false}; return n; });
    } catch (e) {
      setAskHistory(prev => { const n=[...prev]; n[n.length-1]={question,answer:null,sources:[],loading:false,error:e.message||'Failed'}; return n; });
    } finally { setAskLoading(false); }
  }, [askInput, askLoading, askUseHs]);

  const handleDelete = useCallback(async (docId) => {
    if (!window.confirm('Remove from your vault?')) return;
    try { await contextService.deleteDocument(docId); setUserDocs(prev => prev.filter(d => d.doc_id !== docId)); }
    catch { /* silenced */ }
  }, []);

  const totalChunks      = hsStats.total_chunks || 0;
  const filteredSubjects = hsSubjects.filter(s =>
    !archiveSearch || s.subject.toLowerCase().includes(archiveSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="atl-root">
      <div ref={canvasRef} className="atl-canvas"/>

      {/* Sphere labels — JS-positioned each frame */}
      {WORLDS.map((w, i) => (
        <div
          key={w.key}
          ref={el => { labelRefs.current[i] = el; }}
          className="atl-sphere-label"
          onClick={() => setActiveWorld(w.key)}
        >
          <div className="atl-sphere-label-pip"/>
          <span className="atl-sphere-label-name">{w.label}</span>
          <span className="atl-sphere-label-sub">{w.sub}</span>
        </div>
      ))}

      {/* Header */}
      <header className="atl-header">
        <button className="atl-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()}><Menu size={18}/></button>
        <div className="atl-brand" onClick={() => setActiveWorld(null)}>cerbyl</div>
        <nav className="atl-header-nav">
          {WORLDS.map(w => (
            <button
              key={w.key}
              className={`atl-nav-btn${activeWorld===w.key?' atl-nav-btn--active':''}`}
              onClick={() => setActiveWorld(activeWorld===w.key ? null : w.key)}
            >
              {w.label}
            </button>
          ))}
        </nav>
        <button className="atl-btn atl-btn--accent" onClick={() => setUploadOpen(true)}>
          <Plus size={13}/>ADD
        </button>
      </header>

      {/* Home: CERBYL title at top */}
      {activeWorld === null && (
        <div className="atl-home-overlay">
          <h1 className="atl-home-title">cerbyl</h1>
          <p className="atl-home-sub">YOUR LIVING KNOWLEDGE UNIVERSE</p>
          <p className="atl-home-hint">CLICK A WORLD TO BEGIN</p>
        </div>
      )}

      {/* Content panel — slides from right, camera already zoomed */}
      {activeWorld !== null && (
        <div className="atl-panel">
          <button className="atl-panel-back" onClick={() => setActiveWorld(null)}>
            <ChevronLeft size={15}/>BACK
          </button>

          {/* ORACLE */}
          {activeWorld === 'oracle' && (
            <div className="atl-panel-body">
              <div className="atl-panel-hd">
                <h2 className="atl-panel-title">ORACLE</h2>
                <label className="atl-hs-toggle">
                  <input type="checkbox" checked={askUseHs} onChange={e=>setAskUseHs(e.target.checked)}/>
                  <span>CURRICULUM</span>
                </label>
              </div>
              <div className="atl-oracle-history">
                {askHistory.length === 0 ? (
                  <div className="atl-oracle-empty">
                    <p>ASK ANYTHING. ANSWERS CITED FROM YOUR KNOWLEDGE BASE.</p>
                    <div className="atl-oracle-chips">
                      {['Explain natural selection','Integration by parts','Causes of World War I',"Ohm's Law"].map(s=>(
                        <button key={s} className="atl-chip" onClick={()=>handleAsk(s)}>
                          <ArrowRight size={10}/>{s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : askHistory.map((item,i)=>(
                  <div key={i} className="atl-oracle-turn">
                    <div className="atl-q-bubble">{item.question}</div>
                    {item.loading ? (
                      <div className="atl-oracle-loading"><Loader2 size={15} className="atl-spin"/><span>CONSULTING ARCHIVE</span></div>
                    ) : item.error ? (
                      <div className="atl-oracle-error"><AlertCircle size={13}/>{item.error}</div>
                    ) : (
                      <div className="atl-a-bubble">
                        <p>{item.answer}</p>
                        {item.sources?.length > 0 && (
                          <div className="atl-sources">
                            {item.sources.map((src,si)=>(
                              <div key={si} className="atl-source-chip">
                                <FileText size={10}/>
                                [{si+1}] {(src.filename||'').toUpperCase()}{src.page?` P.${src.page}`:''}
                                {src.source==='hs' && <span className="atl-src-badge">CURRICULUM</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={oracleEndRef}/>
              </div>
              <div className="atl-oracle-input-row">
                <textarea
                  className="atl-oracle-textarea"
                  placeholder="ASK THE ORACLE..."
                  value={askInput}
                  onChange={e=>setAskInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleAsk();}}}
                  rows={2} disabled={askLoading}
                />
                <button className="atl-send-btn" onClick={()=>handleAsk()} disabled={askLoading||!askInput.trim()}>
                  {askLoading?<Loader2 size={16} className="atl-spin"/>:<Send size={16}/>}
                </button>
              </div>
            </div>
          )}

          {/* ARCHIVE */}
          {activeWorld === 'archive' && (
            <div className="atl-panel-body">
              <div className="atl-panel-hd">
                <div>
                  <h2 className="atl-panel-title">ARCHIVE</h2>
                  <p className="atl-panel-desc">{hsSubjects.length} SUBJECTS · {totalChunks.toLocaleString()} FRAGMENTS</p>
                </div>
              </div>
              <div className="atl-search-row">
                <Search size={13}/>
                <input className="atl-search-input" placeholder="SEARCH SUBJECTS..." value={archiveSearch} onChange={e=>setArchiveSearch(e.target.value)}/>
                {archiveSearch && <button className="atl-clear-btn" onClick={()=>setArchiveSearch('')}><X size={12}/></button>}
              </div>
              {dataLoading ? (
                <div className="atl-loading"><Loader2 size={22} className="atl-spin"/></div>
              ) : (
                <div className="atl-subject-grid">
                  {filteredSubjects.map((s,i)=>(
                    <button key={i} className="atl-subject-card" onClick={()=>{setAskInput(`Explain ${s.subject}`);setActiveWorld('oracle');}}>
                      <div className="atl-subject-name">{s.subject.toUpperCase()}</div>
                      {s.grade_level && <div className="atl-subject-grade">{s.grade_level}</div>}
                      <div className="atl-subject-count">{s.doc_count} DOCS</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VAULT */}
          {activeWorld === 'vault' && (
            <div className="atl-panel-body">
              <div className="atl-panel-hd">
                <div>
                  <h2 className="atl-panel-title">VAULT</h2>
                  <p className="atl-panel-desc">PRIVATE DOCUMENTS · POWERS THE ORACLE</p>
                </div>
                <div className="atl-panel-hd-actions">
                  <button className="atl-icon-btn" onClick={loadAll}><RefreshCw size={13}/></button>
                  <button className="atl-btn atl-btn--accent" onClick={()=>setUploadOpen(true)}><Plus size={13}/>UPLOAD</button>
                </div>
              </div>
              {dataLoading ? (
                <div className="atl-loading"><Loader2 size={22} className="atl-spin"/></div>
              ) : userDocs.length === 0 ? (
                <div className="atl-vault-empty">
                  <p>NO DOCUMENTS YET. UPLOAD PDFS, TXT, OR MARKDOWN TO POWER THE ORACLE.</p>
                  <button className="atl-btn atl-btn--accent" onClick={()=>setUploadOpen(true)}><Upload size={13}/>UPLOAD FIRST DOCUMENT</button>
                </div>
              ) : (
                <div className="atl-vault-list">
                  {userDocs.map((doc,i)=>(
                    <div key={doc.doc_id||i} className="atl-vault-item">
                      <div className="atl-vault-item-info">
                        <FileText size={15} className="atl-vault-file-icon"/>
                        <div className="atl-vault-item-text">
                          <div className="atl-vault-filename">{(doc.filename||'UNTITLED').toUpperCase()}</div>
                          {doc.ai_summary && <div className="atl-vault-summary">{doc.ai_summary}</div>}
                          <div className="atl-vault-meta">
                            {doc.subject && <span>{doc.subject.toUpperCase()}</span>}
                            {doc.chunk_count>0 && <span>{doc.chunk_count} CHUNKS</span>}
                            {doc.created_at && <span>{fmtDate(doc.created_at).toUpperCase()}</span>}
                          </div>
                          {doc.topic_tags?.length>0 && (
                            <div className="atl-vault-tags">
                              {doc.topic_tags.slice(0,3).map(t=>(
                                <span key={t} className="atl-tag"><Tag size={9}/>{t.toUpperCase()}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="atl-vault-item-actions">
                        <button className="atl-icon-btn" title="Ask Oracle" onClick={()=>{setAskInput(`Summarise ${doc.filename}`);setActiveWorld('oracle');}}>
                          <Brain size={13}/>
                        </button>
                        <button className="atl-icon-btn atl-icon-btn--del" title="Delete" onClick={()=>handleDelete(doc.doc_id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={()=>setUploadOpen(false)} onDone={loadAll}/>
    </div>
  );
}
