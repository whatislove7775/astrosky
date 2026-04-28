// 1. Логика интерфейса: Cookie -> Капча -> Форма -> Сцена
document.getElementById('cookie-btn').addEventListener('click', () => {
    const wrapper = document.getElementById('content-wrapper');
    wrapper.innerHTML = '<p style="text-align:center; font-size: 1rem;">Cookie одобрены.<br><br>Ожидайте загрузки (5 сек)...</p>';
    
    // Задержка 5 секунд перед появлением капчи
    setTimeout(() => {
        wrapper.innerHTML = `
            <p style="text-align:center; font-size: 1rem; line-height: 1.5;">Пожалуйста, подтвердите, что на сайт зашла самая привлекательная турчанка в мире.</p>
            <div style="font-size: 24px; font-style: italic; letter-spacing: 8px; border: 1px dashed #ffffff; padding: 15px; margin: 15px 0;">ЦЕЛУЮ</div>
            <div class="input-group">
                <input type="text" id="captcha-input" placeholder="введите слово с картинки" required>
            </div>
            <button id="verify-btn">ПОДТВЕРДИТЬ</button>
        `;

        document.getElementById('verify-btn').addEventListener('click', () => {
            const val = document.getElementById('captcha-input').value.trim().toLowerCase();
            if (val === 'целую') {
                showMainForm();
            } else {
                alert('Ошибка верификации. Попробуйте еще раз.');
            }
        });
    }, 5000);
});

// Переход к вводу даты рождения
function showMainForm() {
    const wrapper = document.getElementById('content-wrapper');
    wrapper.innerHTML = `
        <h1>ДАННЫЕ РОЖДЕНИЯ</h1>
        <div class="input-group">
            <input type="date" id="birth-date" required>
        </div>
        <div class="input-group">
            <input type="time" id="birth-time" required>
        </div>
        <button id="generate-btn">ПОСТРОИТЬ КАРТУ</button>
    `;

    document.getElementById('generate-btn').addEventListener('click', () => {
        const dateStr = document.getElementById('birth-date').value;
        const timeStr = document.getElementById('birth-time').value;

        if (!dateStr || !timeStr) {
            alert("Пожалуйста, введите дату и время.");
            return;
        }

        // Запуск 3D-сцены
        document.getElementById('ui-container').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('ui-container').style.display = 'none';
            document.getElementById('canvas-container').style.opacity = '1';
            
            const timeHash = new Date(`${dateStr}T${timeStr}`).getTime();
            initScene(timeHash);
        }, 1000);
    });
}

// 2. Логика 3D-сцены
function initScene(timeOffset) {
    const container = document.getElementById('canvas-container');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 30);

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
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 60;

    const skyGroup = new THREE.Group();
    scene.add(skyGroup);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // Земля (черная сфера, чтобы не просвечивали звезды)
    const earthRadius = 3;
    const blackSphere = new THREE.Mesh(
        new THREE.SphereGeometry(earthRadius * 0.99, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    earthGroup.add(blackSphere);

    // Контуры материков
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

    // Астрологические дома
    const sectorsGroup = new THREE.Group();
    const sectorRadius = 18;
    const sectorMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
    const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const points = [
            new THREE.Vector3(Math.cos(angle) * earthRadius, 0, Math.sin(angle) * earthRadius),
            new THREE.Vector3(Math.cos(angle) * sectorRadius, 0, Math.sin(angle) * sectorRadius)
        ];
        
        // Используем THREE.Line для корректного рендера
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), sectorMaterial);
        sectorsGroup.add(line);

        const labelAngle = angle + (Math.PI / 12);
        const labelDiv = document.createElement('div');
        labelDiv.className = 'house-label';
        labelDiv.textContent = romanNumerals[i];
        
        const labelObj = new THREE.CSS2DObject(labelDiv);
        labelObj.position.set(Math.cos(labelAngle) * (sectorRadius + 2), 0, Math.sin(labelAngle) * (sectorRadius + 2));
        sectorsGroup.add(labelObj);
    }
    skyGroup.add(sectorsGroup);

    // Планеты
    const planetsData = [
        { name: 'Солнце', symbol: '☉' }, { name: 'Луна', symbol: '☽' },
        { name: 'Меркурий', symbol: '☿' }, { name: 'Венера', symbol: '♀' },
        { name: 'Марс', symbol: '♂' }, { name: 'Юпитер', symbol: '♃' },
        { name: 'Сатурн', symbol: '♄' }, { name: 'Уран', symbol: '♅' },
        { name: 'Нептун', symbol: '♆' }, { name: 'Плутон', symbol: '♇' }
    ];

    planetsData.forEach((planet, index) => {
        const pseudoRandomSeed = (timeOffset + index * 987654) % 10000;
        const angle = (pseudoRandomSeed / 10000) * Math.PI * 2;
        const distance = 8 + (index % 3) * 2;

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        const pGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(x, 0, z);
        skyGroup.add(pMesh);

        const pDiv = document.createElement('div');
        pDiv.className = 'planet-label';
        pDiv.innerHTML = `<span class="planet-symbol">${planet.symbol}</span>${planet.name}`;
        
        const pObj = new THREE.CSS2DObject(pDiv);
        pObj.position.set(x, 0.5, z);
        skyGroup.add(pObj);
    });

    // Звезды
    const starsCount = 2000;
    const starsPos = [];
    
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

    // Созвездия (линии)
    const constMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    for (let c = 0; c < 25; c++) {
        const centerIndex = Math.floor(Math.random() * (starsCount - 5)) * 3;
        const pts = [];
        pts.push(new THREE.Vector3(starsPos[centerIndex], starsPos[centerIndex+1], starsPos[centerIndex+2]));
        
        for(let lines = 0; lines < 4; lines++) {
            const nextIdx = centerIndex + (lines * 3) + 3;
            pts.push(new THREE.Vector3(starsPos[nextIdx], starsPos[nextIdx+1], starsPos[nextIdx+2]));
        }
        
        // Исправлено: THREE.Line вместо THREE.LineStrip
        const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), constMaterial);
        skyGroup.add(cLine);
    }

    // Вращение
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
        skyGroup.rotation.y += 0.0001;
        
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }
    animate();
}
