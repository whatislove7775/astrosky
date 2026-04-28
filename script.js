let currentAnimation; // Для остановки рендера при выходе
const zodiacSigns = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"];

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
        document.getElementById('astro-panel').classList.remove('hidden');
        initScene(timeHash);
    }, 500);
});

// Кнопка возврата к вводу данных
document.getElementById('edit-btn').addEventListener('click', () => {
    cancelAnimationFrame(currentAnimation); // Останавливаем 3D
    document.getElementById('canvas-container').innerHTML = ''; // Очищаем сцену
    document.getElementById('astro-panel').classList.add('hidden');
    
    document.getElementById('ui-container').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('ui-container').style.opacity = '1';
    }, 100);
});

// Конвертация угла в знак Зодиака для панели
function getZodiacSign(angleRadians) {
    let deg = (angleRadians * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    const signIndex = Math.floor(deg / 30);
    const signDeg = Math.floor(deg % 30);
    return `${signDeg}° ${zodiacSigns[signIndex]}`;
}

function initScene(timeOffset) {
    const container = document.getElementById('canvas-container');
    const panelList = document.getElementById('astro-data-list');
    panelList.innerHTML = ''; // Очищаем панель

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 60;

    // --- СВЕТ (Для объемности планет) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    const skyGroup = new THREE.Group();
    scene.add(skyGroup);
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // --- 1. ЗЕМЛЯ ---
    const earthRadius = 3;
    const blackSphere = new THREE.Mesh(
        new THREE.SphereGeometry(earthRadius * 0.99, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x050505 })
    );
    earthGroup.add(blackSphere);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.8 });
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
        .then(response => response.json())
        .then(data => {
            data.features.forEach(feature => {
                const geom = feature.geometry;
                if (geom.type === 'Polygon') drawPolygon(geom.coordinates[0]);
                else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => drawPolygon(poly[0]));
            });
        });

    function drawPolygon(coords) {
        const points = coords.map(c => {
            const phi = (90 - c[1]) * (Math.PI / 180), theta = (c[0] + 180) * (Math.PI / 180);
            return new THREE.Vector3(-(earthRadius * Math.sin(phi) * Math.cos(theta)), earthRadius * Math.cos(phi), earthRadius * Math.sin(phi) * Math.sin(theta));
        });
        earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
    }

    // --- 2. ДОМА (Сектора) ---
    const sectorsGroup = new THREE.Group();
    const sectorRadius = 18;
    const sectorMaterial = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
    const houseNames = ["I Дом (ASC)", "II Дом", "III Дом", "IV Дом (IC)", "V Дом", "VI Дом", "VII Дом (DSC)", "VIII Дом", "IX Дом", "X Дом (MC)", "XI Дом", "XII Дом"];

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const points = [
            new THREE.Vector3(Math.cos(angle) * earthRadius, 0, Math.sin(angle) * earthRadius),
            new THREE.Vector3(Math.cos(angle) * sectorRadius, 0, Math.sin(angle) * sectorRadius)
        ];
        sectorsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), sectorMaterial));

        const labelAngle = angle + (Math.PI / 12);
        const labelDiv = document.createElement('div');
        labelDiv.className = 'house-label'; labelDiv.textContent = houseNames[i];
        
        const labelObj = new THREE.CSS2DObject(labelDiv);
        labelObj.position.set(Math.cos(labelAngle) * (sectorRadius + 2), 0, Math.sin(labelAngle) * (sectorRadius + 2));
        sectorsGroup.add(labelObj);
    }
    skyGroup.add(sectorsGroup);

    // --- 3. ПЛАНЕТЫ (Основные и фиктивные) ---
    const planets = [
        { name: 'Солнце', sym: '☉', color: 0xffcc00, size: 0.6, type: 'main' },
        { name: 'Луна', sym: '☽', color: 0xdddddd, size: 0.4, type: 'main' },
        { name: 'Меркурий', sym: '☿', color: 0xaaaaaa, size: 0.25, type: 'main' },
        { name: 'Венера', sym: '♀', color: 0xffeebb, size: 0.3, type: 'main' },
        { name: 'Марс', sym: '♂', color: 0xff5522, size: 0.28, type: 'main' },
        { name: 'Юпитер', sym: '♃', color: 0xdca971, size: 0.5, type: 'main' },
        { name: 'Сатурн', sym: '♄', color: 0xeeddcc, size: 0.45, ring: true, type: 'main' },
        { name: 'Уран', sym: '♅', color: 0x88ccff, size: 0.35, type: 'main' },
        { name: 'Нептун', sym: '♆', color: 0x3344ee, size: 0.35, type: 'main' },
        { name: 'Плутон', sym: '♇', color: 0x777777, size: 0.2, type: 'main' },
        // Еле заметные объекты
        { name: 'Лилит', sym: '⚸', color: 0x333333, size: 0.15, type: 'minor' },
        { name: 'Хирон', sym: '⚷', color: 0x444444, size: 0.15, type: 'minor' },
        { name: 'Сев. Узел', sym: '☊', color: 0x555555, size: 0.15, type: 'minor' }
    ];

    planets.forEach((planet, index) => {
        const seed = (timeOffset + index * 12345) % 10000;
        const angle = (seed / 10000) * Math.PI * 2;
        const distance = 6 + (index % 5) * 2.5; // Распределяем по радиусу
        const isMinor = planet.type === 'minor';

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        // Объемная сфера планеты (MeshStandardMaterial реагирует на свет)
        const pGeo = new THREE.SphereGeometry(planet.size, 16, 16);
        const pMat = new THREE.MeshStandardMaterial({ 
            color: planet.color, 
            roughness: 0.4,
            transparent: isMinor,
            opacity: isMinor ? 0.3 : 1
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(x, 0, z);

        // Кольцо для Сатурна
        if (planet.ring) {
            const ringGeo = new THREE.RingGeometry(planet.size + 0.1, planet.size + 0.4, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: planet.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2.5; // Наклоняем кольцо
            pMesh.add(ringMesh);
        }
        skyGroup.add(pMesh);

        // Подпись планеты
        const pDiv = document.createElement('div');
        pDiv.className = `planet-label ${isMinor ? 'minor' : ''}`;
        pDiv.innerHTML = `<span class="planet-symbol">${planet.sym}</span>${planet.name}`;
        
        const pObj = new THREE.CSS2DObject(pDiv);
        pObj.position.set(x, planet.size + 0.5, z);
        skyGroup.add(pObj);

        // Добавляем данные в боковую панель
        const zodiacData = getZodiacSign(angle);
        const row = document.createElement('div');
        row.className = 'astro-row';
        row.innerHTML = `<span class="astro-planet">${planet.sym} ${planet.name}</span><span class="astro-sign">${zodiacData}</span>`;
        panelList.appendChild(row);
    });

    // --- 4. ЗВЕЗДЫ И СОЗВЕЗДИЯ ---
    const starsCount = 1500;
    const starsPos = [];
    for(let i = 0; i < starsCount; i++) {
        const r = 40 + Math.random() * 40;
        const theta = 2 * Math.PI * Math.random(), phi = Math.acos(2 * Math.random() - 1);
        starsPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
    }
    skyGroup.add(new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3)),
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, opacity: 0.6, transparent: true })
    ));

    // Еле заметные абстрактные линии созвездий
    const constMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 });
    for (let c = 0; c < 20; c++) {
        const centerIndex = Math.floor(Math.random() * (starsCount - 5)) * 3;
        const pts = [new THREE.Vector3(starsPos[centerIndex], starsPos[centerIndex+1], starsPos[centerIndex+2])];
        for(let lines = 0; lines < 3; lines++) {
            const nextIdx = centerIndex + (lines * 3) + 3;
            pts.push(new THREE.Vector3(starsPos[nextIdx], starsPos[nextIdx+1], starsPos[nextIdx+2]));
        }
        skyGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), constMaterial));
    }

    // Вращение
    skyGroup.rotation.y = (timeOffset % 1000000) * 0.0001;

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
        currentAnimation = requestAnimationFrame(animate);
        controls.update();
        skyGroup.rotation.y += 0.00005; // Очень плавное вращение
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }
    animate();
}
