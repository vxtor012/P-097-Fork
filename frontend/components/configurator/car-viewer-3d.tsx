"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw, Play, Pause, Box, AlertCircle } from "lucide-react";

interface CarViewer3DProps {
  /** Đường dẫn file model .glb (được nén DRACO) */
  modelUrl?: string | null;
  /** Tên dòng xe */
  modelName: string;
  /** Màu hex đang chọn (ví dụ: #FFFFFF, #1a1a1a, ...) */
  colorHex?: string;
  /** Màu nóc xe cho các phiên bản two-tone (nóc trắng, nóc đen, ...) */
  roofHex?: string;
  /** Component fallback 2D hiển thị khi không có model 3D */
  fallback2D?: React.ReactNode;
  className?: string;
}

export function CarViewer3D({
  modelUrl,
  modelName,
  colorHex,
  roofHex,
  fallback2D,
  className = "",
}: CarViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  // References cho Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const carPaintMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const carRoofMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const vf8MeshesRef = useRef<THREE.Mesh[]>([]);
  const modelRadiusRef = useRef<number>(2.5);

  const defaultCamPos = useRef(new THREE.Vector3(5.0, 1.2, 5.0));
  const defaultTarget = useRef(new THREE.Vector3(0, 0.45, 0));

  const hasModel = Boolean(modelUrl && modelUrl.trim() !== "");

  // Hàm tô màu 2 tông (Upper Body / Roof / Hood vs Lower Body) cho VF8 bằng Vertex Colors
  const applyVF8Colors = useCallback(
    (mesh: THREE.Mesh, bodyHex?: string, roofHex?: string) => {
      const geom = mesh.geometry;
      if (!geom || !geom.attributes.position) return;
      const pos = geom.attributes.position;
      const count = pos.count;

      const bodyCol = new THREE.Color(bodyHex || "#FFFFFF");
      const targetRoof = roofHex || bodyHex || "#FFFFFF";
      const roofCol = new THREE.Color(targetRoof);
      const taillightCavityCol = new THREE.Color("#300505"); // Nền hốc đèn hậu màu đỏ sẫm chống lem màu vỏ xe
      const isTwoTone = targetRoof.toLowerCase() !== (bodyHex || "#FFFFFF").toLowerCase();

      let colAttr = geom.attributes.color as THREE.BufferAttribute | undefined;
      if (!colAttr || colAttr.count !== count) {
        const colors = new Float32Array(count * 3);
        colAttr = new THREE.BufferAttribute(colors, 3);
        geom.setAttribute("color", colAttr);
      }

      const colors = colAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        // Bảo vệ hốc đèn hậu: Luôn giữ nền đỏ sẫm nguyên bản, không bao giờ nhận màu sơn xe
        const isTaillightCavity =
          z >= 21.4 && y >= 8.2 && y <= 9.8 && Math.abs(x) <= 8.5;

        if (isTaillightCavity) {
          colors[i * 3] = taillightCavityCol.r;
          colors[i * 3 + 1] = taillightCavityCol.g;
          colors[i * 3 + 2] = taillightCavityCol.b;
          continue;
        }

        // Phân loại nửa trên (Nóc xe, mui xe, nắp capo, cột trụ A-B-C, phần đuôi dưới kính) theo chuẩn hai tông VinFast VF8 LUX:
        // 1. Toàn bộ mui nóc xe và vòm mui ở Y >= 12.8
        // 2. Cột trụ A, B, C, mui viền kính ở Z in [-7.5, 15.0] với Y >= 10.6 và |X| <= 8.9
        // 3. Toàn bộ nắp capo phía trước ở Z <= -7.5 với Y >= (7.05 + (z + 24.1) * 0.155) và |X| <= 8.85
        // 4. Phần đuôi dưới kính sau trên đèn hậu ở Z in [15.0, 21.6] với Y >= 9.8 và |X| <= 8.7
        const isRoof =
          isTwoTone &&
          (y >= 12.8 ||
            (z > -7.5 && z < 15.0 && y >= 10.6 && Math.abs(x) <= 8.9) ||
            (z <= -7.5 && y >= (7.05 + (z + 24.1) * 0.155) && Math.abs(x) <= 8.85) ||
            (z >= 15.0 && z <= 21.6 && y >= 9.8 && Math.abs(x) <= 8.7));

        const c = isRoof ? roofCol : bodyCol;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      colAttr.needsUpdate = true;
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      if (mat) {
        mat.vertexColors = true;
        mat.color.setRGB(1, 1, 1);
        mat.needsUpdate = true;
      }
    },
    []
  );

  // Đặt lại góc nhìn
  const handleResetCamera = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(defaultCamPos.current);
      controlsRef.current.target.copy(defaultTarget.current);
      controlsRef.current.update();
    }
  }, []);

  // Cập nhật màu sơn thân xe và nóc xe
  useEffect(() => {
    // 1. Nếu là VF8: Áp dụng vertex colors hai tông cho các mesh vỏ xe
    if (vf8MeshesRef.current.length > 0) {
      vf8MeshesRef.current.forEach((mesh) => {
        applyVF8Colors(mesh, colorHex, roofHex);
      });
    }

    // 2. Thân xe thông thường (VF3, VF5, VF6, VF7, VF9)
    if (carPaintMaterialsRef.current.length > 0 && colorHex) {
      const targetColor = new THREE.Color(colorHex);
      carPaintMaterialsRef.current.forEach((mat) => {
        mat.color.copy(targetColor);
        mat.needsUpdate = true;
      });
    }

    // 3. Nóc xe thông thường
    if (carRoofMaterialsRef.current.length > 0) {
      const targetRoof = roofHex || colorHex;
      if (targetRoof) {
        const roofColor = new THREE.Color(targetRoof);
        carRoofMaterialsRef.current.forEach((mat) => {
          mat.color.copy(roofColor);
          mat.needsUpdate = true;
        });
      }
    }
  }, [colorHex, roofHex, applyVF8Colors]);

  // Cập nhật chế độ tự động xoay
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Khởi tạo Three.js
  useEffect(() => {
    if (!hasModel) {
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setLoadProgress(0);
    setHasError(false);
    carPaintMaterialsRef.current = [];
    carRoofMaterialsRef.current = [];
    vf8MeshesRef.current = [];

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera: FOV 28 độ chuẩn góc nhìn phối cảnh studio xe hơi
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.copy(defaultCamPos.current);
    cameraRef.current = camera;

    // 3. Renderer: Nền hoàn toàn trong suốt (alpha: true) hiển thị liền mạch trên nền trắng
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0); // Trong suốt tuyệt đối
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25; // Tăng sáng một chút ít, giúp xe sáng rõ, nổi khối bóng bẩy
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.replaceChildren(renderer.domElement);

    // 4. Controls: Tự động quay theo chiều thuận kim đồng hồ (-1.8)
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = -1.8; // Dấu âm giúp quay THUẬN chiều kim đồng hồ
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minPolarAngle = Math.PI / 2.8; // ~64 độ
    controls.target.copy(defaultTarget.current);
    controls.update();

    // 5. Studio Showroom Lighting - Cân bằng tự nhiên, sáng đẹp nổi bật khối xe và gân dập nổi
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 1.1);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Key Light rọi chéo trước bên trái (ánh sáng chính tạo khối xe)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(6, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    // Fill Light làm mềm bóng phía sau bên phải
    const fillLight = new THREE.DirectionalLight(0xf1f5f9, 1.4);
    fillLight.position.set(-6, 6, -5);
    scene.add(fillLight);

    // Top Light phản chiếu dịu trên mui và nóc xe
    const topLight = new THREE.DirectionalLight(0xffffff, 1.1);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);

    // Rim Light rọi nhẹ phía sau đuôi xe giúp dải đèn hậu và thân sau luôn sáng rõ, nổi khối
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 4, -7);
    scene.add(rimLight);

    // 6. Bóng đổ mềm tự nhiên dưới gầm xe (Fade out 100% về 0, không có viền mép)
    const shadowSize = 16;
    const shadowGeo = new THREE.PlaneGeometry(shadowSize, shadowSize);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Tâm bóng đổ hình oval mềm mại lan tỏa tự nhiên, biến mất hoàn toàn trước 70% bán kính
      const gradient = ctx.createRadialGradient(256, 256, 20, 256, 256, 220);
      gradient.addColorStop(0, "rgba(15, 23, 42, 0.40)");
      gradient.addColorStop(0.25, "rgba(15, 23, 42, 0.20)");
      gradient.addColorStop(0.55, "rgba(15, 23, 42, 0.04)");
      gradient.addColorStop(0.75, "rgba(15, 23, 42, 0)"); // Tan biến tuyệt đối về 0
      gradient.addColorStop(1.0, "rgba(15, 23, 42, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
    }
    const shadowTexture = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.002;
    scene.add(shadowMesh);

    // 7. GLTFLoader + DRACOLoader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    let isDisposed = false;
    let modelScene: THREE.Group | null = null;

    // Hàm tính toán khoảng cách camera tự thích ứng (Responsive Frame Fitting)
    const fitCameraToModel = (radius: number, target: THREE.Vector3) => {
      if (!camera || !controlsRef.current) return;
      const fovY = THREE.MathUtils.degToRad(camera.fov);
      // Tính góc FOV theo chiều ngang dựa trên tỷ lệ khung hình thực tế
      const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect);
      // Góc nhìn hiệu dụng là góc nhỏ hơn giữa dọc và ngang
      const effectiveFov = Math.min(fovY, fovX);

      // Khoảng cách bao trọn toàn bộ xe vừa vặn, to đẹp và rõ nét (hệ số 1.08)
      const distance = (radius / Math.sin(effectiveFov / 2)) * 1.08;

      const isVF8 = modelName.includes("VF 8") || modelName.includes("VF8");

      // Hướng góc chéo trước bên trái (Front 3/4 view kiểu showroom Tesla)
      // Đối với VF8: Do model nguyên bản đầu xe quay về Z âm (-24), camera đặt ở (-1.15, 0.35, -1.1)
      // để nhìn thấy đầu xe chéo ở góc dưới bên trái màn hình đồng bộ với các mẫu xe khác
      const viewDir = isVF8
        ? new THREE.Vector3(-1.15, 0.35, -1.1).normalize()
        : new THREE.Vector3(1.15, 0.35, 1.1).normalize();

      const newPos = target.clone().addScaledVector(viewDir, distance);

      camera.position.copy(newPos);
      camera.lookAt(target);

      defaultCamPos.current.copy(newPos);
      defaultTarget.current.copy(target);

      controlsRef.current.target.copy(target);
      controlsRef.current.minDistance = distance * 0.55;
      controlsRef.current.maxDistance = distance * 2.2;
      controlsRef.current.update();
    };

    gltfLoader.load(
      modelUrl!,
      (gltf) => {
        if (isDisposed) return;
        modelScene = gltf.scene;

        const isVF3 = modelName.includes("VF 3") || modelName.includes("VF3");
        const isVF5 = modelName.includes("VF 5") || modelName.includes("VF5");
        const isVF8 = modelName.includes("VF 8") || modelName.includes("VF8");

        // Tính Bounding Box nguyên bản của model
        const originalBox = new THREE.Box3().setFromObject(gltf.scene);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        const originalCenter = originalBox.getCenter(new THREE.Vector3());

        // CHUẨN HÓA KÍCH THƯỚC XE (Scale Normalization):
        // Chuẩn hóa chiều dài xe về 4.0 đơn vị tiêu chuẩn
        const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z);
        const targetLength = 4.0;
        const scaleFactor = targetLength / (maxDimension || 1);

        gltf.scene.scale.setScalar(scaleFactor);

        // Sau khi scale, đặt đáy xe chạm đúng sàn y = 0, tâm xe nằm tại (0, z_center)
        gltf.scene.position.x = -originalCenter.x * scaleFactor;
        gltf.scene.position.y = -originalBox.min.y * scaleFactor;
        gltf.scene.position.z = -originalCenter.z * scaleFactor;

        // Tìm kiếm các vật liệu vỏ xe để đổi màu ngoại thất (thân xe và nóc xe)
        const detectedPaintMaterials: THREE.MeshStandardMaterial[] = [];
        const detectedRoofMaterials: THREE.MeshStandardMaterial[] = [];
        const detectedVF8Meshes: THREE.Mesh[] = [];
        const ignoredNames = [
          "glass", "window", "tire", "licplate", "led", "interior",
          "leather", "seat", "brake", "disk", "mirror", "chrome", "wheel", "piping"
        ];

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            matList.forEach((rawMat) => {
              if (rawMat && "color" in rawMat) {
                const mat = rawMat as THREE.MeshStandardMaterial;
                const matName = (mat.name || "").toLowerCase();
                const meshName = (mesh.name || "").toLowerCase();

                // 1. Nhận diện nóc xe VF3 (Mesh 008-0-8 hoặc vật liệu "white")
                if (isVF3 && (matName === "white" || meshName === "008-0-8")) {
                  mat.roughness = Math.min(mat.roughness ?? 0.22, 0.28);
                  mat.metalness = Math.max(mat.metalness ?? 0.35, 0.38);
                  const targetRoof = roofHex || colorHex;
                  if (targetRoof) mat.color.setStyle(targetRoof);
                  detectedRoofMaterials.push(mat);
                  return;
                }

                // 2. Nhận diện nóc xe VF5 (Mesh 030-0-30 hoặc vật liệu "black__1")
                if (isVF5 && (matName === "black__1" || meshName === "030-0-30")) {
                  mat.roughness = Math.min(mat.roughness ?? 0.22, 0.28);
                  mat.metalness = Math.max(mat.metalness ?? 0.35, 0.38);
                  const targetRoof = roofHex || colorHex;
                  if (targetRoof) mat.color.setStyle(targetRoof);
                  detectedRoofMaterials.push(mat);
                  return;
                }

                // 3. Nhận diện vỏ sơn xe VF8 (Mesh 085 đến 100 với vật liệu v?_xe__1)
                if (isVF8 && matName.includes("xe")) {
                  detectedVF8Meshes.push(mesh);
                  return;
                }

                // 4. Riêng VF8: Cụm đèn hậu 'led__1' trong file GLB gốc có alpha = 0.018 nên cần set opacity để hiển thị màu đỏ sắc nét
                if (isVF8 && matName.includes("led__1")) {
                  mat.transparent = true;
                  mat.opacity = 0.95;
                  mat.depthWrite = true;
                  mat.color.setRGB(0.85, 0.05, 0.05);
                  mat.emissive.setRGB(0.85, 0.05, 0.05);
                  mat.emissiveIntensity = 1.0;
                  mat.toneMapped = true;
                  return;
                }

                const isIgnored = ignoredNames.some(
                  (ign) => matName.includes(ign) || meshName.includes(ign)
                );

                const isPaint =
                  !isIgnored &&
                  (matName.includes("paint") ||
                    matName.includes("v?_xe") ||
                    matName.includes("v__xe") ||
                    matName.includes("vo_xe") ||
                    matName.includes("body") ||
                    matName.includes("car") ||
                    matName.includes("primary"));

                if (isPaint) {
                  mat.roughness = Math.min(mat.roughness ?? 0.22, 0.28);
                  mat.metalness = Math.max(mat.metalness ?? 0.35, 0.38);
                  if (colorHex) {
                    mat.color.setStyle(colorHex);
                  }
                  detectedPaintMaterials.push(mat);
                }
              }
            });
          }
        });

        // Áp dụng màu cho VF8 (hỗ trợ cả một tông và hai tông nắp capo / mui / nóc xe)
        if (isVF8 && detectedVF8Meshes.length > 0) {
          vf8MeshesRef.current = detectedVF8Meshes;
          detectedVF8Meshes.forEach((mesh) => {
            applyVF8Colors(mesh, colorHex, roofHex);
          });
        }

        // Fallback an toàn (chỉ khi hoàn toàn không tìm thấy và tuân thủ nghiêm ngặt ignoredNames)
        if (!isVF8 && detectedPaintMaterials.length === 0 && colorHex) {
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
              if (mat && "color" in mat && !mat.transparent) {
                const mName = (mat.name || "").toLowerCase();
                if (!ignoredNames.some((ign) => mName.includes(ign))) {
                  detectedPaintMaterials.push(mat);
                }
              }
            }
          });
          if (detectedPaintMaterials[0]) {
            detectedPaintMaterials[0].color.setStyle(colorHex);
          }
        }

        carPaintMaterialsRef.current = detectedPaintMaterials;
        carRoofMaterialsRef.current = detectedRoofMaterials;

        scene.add(gltf.scene);

        // TÍNH BÁN KÍNH VÀ CĂN CHỈNH CAMERA BAO TRỌN XE HOÀN HẢO
        const scaledBox = new THREE.Box3().setFromObject(gltf.scene);
        const sphere = scaledBox.getBoundingSphere(new THREE.Sphere());
        modelRadiusRef.current = sphere.radius;
        const modelCenter = new THREE.Vector3(0, sphere.center.y, 0);

        fitCameraToModel(sphere.radius, modelCenter);

        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error("Lỗi khi tải 3D model:", err);
        setHasError(true);
        setLoading(false);
      }
    );

    // 8. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer: Cập nhật kích thước renderer full 100% và fit lại khoảng cách camera
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);

      if (modelScene) {
        fitCameraToModel(modelRadiusRef.current, defaultTarget.current);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);

      controls.dispose();
      dracoLoader.dispose();

      if (modelScene) {
        scene.remove(modelScene);
      }

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.remove();
      }
    };
  }, [modelUrl, hasModel]);

  // TRƯỜNG HỢP: Mẫu xe không có model 3D hoặc load bị lỗi -> hiển thị liền mạch trên nền trắng
  if (!hasModel || hasError) {
    return (
      <div className={`relative flex h-full w-full flex-col items-center justify-center p-6 ${className}`}>
        {/* Thông báo thanh lịch theo đúng yêu cầu */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
          <AlertCircle size={15} className="text-amber-500" />
          <span>Hiện chưa có bản xem trước</span>
        </div>

        {/* Hiển thị ảnh 2D liền mạch trên nền trắng */}
        <div className="relative w-full max-w-[680px]">
          {fallback2D}
          <div className="pointer-events-none mx-auto h-4 w-3/4 -translate-y-2 rounded-full bg-slate-900/10 blur-md" />
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Mô hình 3D cho dòng xe <span className="font-medium text-slate-600">{modelName}</span> đang được hoàn thiện.
        </p>
      </div>
    );
  }

  // TRƯỜNG HỢP: Mẫu xe có model 3D (Hiển thị 3D Three.js tràn full 100% không gian)
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {/* Khung hiển thị Three.js: Lấp đầy 100% chiều rộng và chiều cao */}
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Hiệu ứng đang tải (Loading nhẹ nhàng) */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px]">
          <div className="relative mb-3 flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <Box size={18} className="text-slate-800" />
          </div>
          <p className="text-xs font-medium text-slate-700">
            Đang tải mô hình 3D... {loadProgress > 0 ? `${loadProgress}%` : ""}
          </p>
        </div>
      )}

      {/* Bộ điều khiển tối giản ở góc dưới bên phải */}
      <div className="absolute bottom-2.5 right-3 z-20 flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-0.5 shadow-sm backdrop-blur-md xl:bottom-4 xl:right-5 xl:p-1">
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          title={autoRotate ? "Tạm dừng tự xoay" : "Bật tự xoay 360°"}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition xl:h-8 xl:w-8 ${
            autoRotate
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {autoRotate ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <button
          type="button"
          onClick={handleResetCamera}
          title="Đặt lại góc nhìn xe"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 xl:h-8 xl:w-8"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Gợi ý nhẹ nhàng dưới đáy */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-[10px] font-medium text-slate-400 xl:bottom-4 xl:text-[11px]">
        Xoay 360° để xem mọi góc cạnh
      </div>
    </div>
  );
}
