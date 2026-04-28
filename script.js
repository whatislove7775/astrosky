document.getElementById('generate-btn').addEventListener('click', () => {
    const dateStr = document.getElementById('birth-date').value;
    const timeStr = document.getElementById('birth-time').value;

    if (!dateStr || !timeStr) {
        alert("Пожалуйста, введите дату и время.");
        return;
    }

    // Скрываем UI и показываем канвас
    document.getElementById('ui-container').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('ui-container').style.display = 'none';
        document.getElementById('canvas-container').style.opacity = '1';
        
        // В реальном проекте здесь дата и время уходили бы на сервер 
        // для расчета эфемерид. Сейчас мы используем их для сдвига карты.
        const timeHash = new Date(`${dateStr}T${timeStr}`).getTime();
        initScene(timeHash);
    }, 1000);
});

function initScene(timeOffset) {
    const container = document.getElementById('canvas-container');

    // 1. Сцена, Камера, Рендерер
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 20); // Немного сверху и сбоку

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 2. Управление мышью (OrbitControls)
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false; // Отключаем смещение, только вращение
    controls.minDistance = 5;
    controls.maxDistance = 50;

    // Группа для всей небесной сферы, чтобы вращать её целиком
    const skyGroup = new THREE.Group();
    scene.add(skyGroup);

    // 3. Планета (Множество белых контуров)
    // Используем SphereGeometry с wireframe: true
    const earthGeometry = new THREE.SphereGeometry(3, 32, 32);
    const earthMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // 4. Разделение на 12 секторов (Астрологические дома)
    const sectorsGroup = new THREE.Group();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const radius = 15; // Длина линий секторов

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const points = [];
        // Линия от поверхности планеты в космос
        points.push(new THREE.Vector3(Math.cos(angle) * 3, 0, Math.sin(angle) * 3));
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        sectorsGroup.add(line);
    }
    skyGroup.add(sectorsGroup);

    // 5. Звездное небо
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 3000;
    const posArray = new Float32Array(starsCount * 3);

    for(let i = 0; i < starsCount * 3; i++) {
        // Генерируем звезды на отдалении (от 20 до 100 единиц)
        const r = 20 + Math.random() * 80;
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        posArray[i] = (i % 3 === 0) ? x : (i % 3 === 1) ? y : z;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    const starMesh = new THREE.Points(starsGeometry, starsMaterial);
    skyGroup.add(starMesh);

    // Сдвигаем карту в зависимости от времени (имитация разного неба)
    const offsetRotation = (timeOffset % 1000000) * 0.0001;
    skyGroup.rotation.y = offsetRotation;

    // 6. Обработка изменения размера окна
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 7. Анимационный цикл
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Обязательно для плавного затухания контроллеров
        
        // Медленное вращение звездного неба для динамики
        skyGroup.rotation.y += 0.0002;
        
        renderer.render(scene, camera);
    }
    animate();
}
