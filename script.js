document.getElementById('generate-btn').addEventListener('click', () => {
    const dateStr = document.getElementById('birth-date').value;
    const timeStr = document.getElementById('birth-time').value;

    if (!dateStr || !timeStr) {
        alert("Пожалуйста, введите дату и время.");
        return;
    }

    document.getElementById('ui-container').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('ui-container').style.display = 'none';
        document.getElementById('canvas-container').style.opacity = '1';
        
        const timeHash = new Date(`${dateStr}T${timeStr}`).getTime();
        initScene(timeHash);
    }, 1000);
});

function initScene(timeOffset) {
    const container = document.getElementById('canvas-container');

    // Сцена, Камера, Рендерер
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // CSS2D Рендерер для текста
    const labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 60;

    const skyGroup = new THREE.Group();
    scene.add(skyGroup);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // --- 1. ЗЕМЛЯ (Черная сфера + контуры материков) ---
    const earthRadius = 3;
    // Твердая черная сфера внутри, чтобы звезды не просвечивали сквозь Землю
    const blackSphere = new THREE.Mesh(
        new THREE.SphereGeometry(earthRadius * 0.99, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    earthGroup.add(blackSphere);

    // Загружаем контуры материков (GeoJSON)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
        .then(response => response.json())
        .then(data => {
            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (geometry.type === 'Polygon') {
                    drawPolygon(geometry.coordinates[0]);
                } else if (geometry.type === 'MultiPolygon') {
                    geometry.coordinates.forEach(polygon => drawPolygon(polygon[0]));
                }
            });
        });

    function drawPolygon(coordinates) {
        const points = [];
        coordinates.forEach(coord => {
            const lon = coord[0];
            const lat = coord[1];
            // Конвертация широты/долготы в 3D координаты
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);
            const x = -(earthRadius * Math.sin(phi) * Math.cos(theta));
            const z = (earthRadius * Math.sin(phi) * Math.sin(theta));
            const y = (earthRadius * Math.cos(phi));
            points.push(new THREE.Vector3(x, y, z));
        });
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        earthGroup.add(new THREE.Line(geom, lineMaterial));
    }

    // --- 2. ДОМА (Сектора) и ПОДПИСИ ---
    const sectorsGroup = new THREE.Group();
    const sectorRadius = 18;
    const sectorMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
    
    const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        
        // Линия сектора
        const points = [
            new THREE.Vector3(Math.cos(angle) * earthRadius, 0, Math.sin(angle) * earthRadius),
            new THREE.Vector3(Math.cos(angle) * sectorRadius, 0, Math.sin(angle) * sectorRadius)
        ];
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), sectorMaterial);
        sectorsGroup.add(line);

        // Подпись дома (в середине сектора)
        const labelAngle = angle + (Math.PI / 12); // Сдвигаем на полсектора
        const labelDiv = document.createElement('div');
        labelDiv.className = 'house-label';
        labelDiv.textContent = romanNumerals[i];
        
        const labelObj = new THREE.CSS2DObject(labelDiv);
        labelObj.position.set(Math.cos(labelAngle) * (sectorRadius + 2), 0, Math.sin(labelAngle) * (sectorRadius + 2));
        sectorsGroup.add(labelObj);
    }
    skyGroup.add(sectorsGroup);

    // --- 3. ПЛАНЕТЫ (Симуляция) ---
    // Данные для отображения (симуляция на основе введенного времени)
    const planetsData = [
        { name: 'Солнце', symbol: '☉' }, { name: 'Луна', symbol: '☽' },
        { name: 'Меркурий', symbol: '☿' }, { name: 'Венера', symbol: '♀' },
        { name: 'Марс', symbol: '♂' }, { name: 'Юпитер', symbol: '♃' },
        { name: 'Сатурн', symbol: '♄' }, { name: 'Уран', symbol: '♅' },
        { name: 'Нептун', symbol: '♆' }, { name: 'Плутон', symbol: '♇' }
    ];

    planetsData.forEach((planet, index) => {
        // Генерируем "псевдослучайный" угол на основе времени рождения, чтобы карта менялась
        const pseudoRandomSeed = (timeOffset + index * 987654) % 10000;
        const angle = (pseudoRandomSeed / 10000) * Math.PI * 2;
        const distance = 8 + (index % 3) * 2; // Разносим планеты по радиусу, чтобы не слипались

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        // Маленькая точка для планеты
        const pGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(x, 0, z);
        skyGroup.add(pMesh);

        // HTML метка планеты
        const pDiv = document.createElement('div');
        pDiv.className = 'planet-label';
        pDiv.innerHTML = `<span class="planet-symbol">${planet.symbol}</span>${planet.name}`;
        
        const pObj = new THREE.CSS2DObject(pDiv);
        pObj.position.set(x, 0.5, z);
        skyGroup.add(pObj);
    });

    // --- 4. ЗВЕЗДЫ И СОЗВЕЗДИЯ ---
    const starsCount = 2000;
    const starsPos = [];
    
    // Генерируем точки звезд
    for(let i = 0; i < starsCount; i++) {
        const r = 30 + Math.random() * 50;
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        starsPos.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }

    const starsGeom = new THREE.BufferGeometry();
    starsGeom.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
    const starMesh = new THREE.Points(starsGeom, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, opacity: 0.8, transparent: true }));
    skyGroup.add(starMesh);

    // Рисуем линии созвездий (соединяем случайные близкие звезды)
    const constMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    for (let c = 0; c < 25; c++) {
        // Берем случайную звезду как центр созвездия
        const centerIndex = Math.floor(Math.random() * (starsCount - 5)) * 3;
        const pts = [];
        pts.push(new THREE.Vector3(starsPos[centerIndex], starsPos[centerIndex+1], starsPos[centerIndex+2]));
        
        // Добавляем к ней 3-4 линии
        for(let lines = 0; lines < 4; lines++) {
            const nextIdx = centerIndex + (lines * 3) + 3;
            pts.push(new THREE.Vector3(starsPos[nextIdx], starsPos[nextIdx+1], starsPos[nextIdx+2]));
        }
        const cLine = new THREE.LineStrip(new THREE.BufferGeometry().setFromPoints(pts), constMaterial);
        skyGroup.add(cLine);
    }

    // Вращение карты
    const offsetRotation = (timeOffset % 1000000) * 0.0001;
    skyGroup.rotation.y = offsetRotation;

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        skyGroup.rotation.y += 0.0001; // Очень медленное вращение
        
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera); // Рендерим текст
    }
    animate();
}
