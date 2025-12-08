/**
 * Three.js Volumetric Clouds Scene
 * Optimized alternative to Vanta.js using custom shaders
 * Uses ray-marching for realistic volumetric cloud rendering
 */

class ThreeJSVolumetricClouds {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.intensity = options.intensity ?? 0.8;
        this.cloudCover = options.cloudCover ?? 50; // 0-100%
        this.running = false;
        this.animationId = null;

        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cloudMaterial = null;
        this.time = 0;

        this.init();
    }

    init() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
        this.camera.position.set(0, 0, 5);

        // Create renderer with optimized settings
        this.renderer = new THREE.WebGLRenderer({
            antialias: false, // Disable for performance
            alpha: true,
            powerPreference: 'low-power' // Favor battery life
        });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x

        // Ensure canvas fills container
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.pointerEvents = 'none';

        this.container.appendChild(this.renderer.domElement);

        // Create volumetric cloud shader material
        this.createCloudMaterial();

        // Create cloud mesh
        this.createCloudMesh();

        // Start animation
        this.start();
    }

    createCloudMaterial() {
        const palette = this.getPalette();

        // Volumetric cloud shader
        const vertexShader = `
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float time;
            uniform vec3 skyColor;
            uniform vec3 cloudColor;
            uniform vec3 cloudShadowColor;
            uniform vec3 sunColor;
            uniform float cloudDensity;
            uniform float cloudCoverage; // 0.0-1.0 (maps from 0-100%)
            uniform float cloudSpeed;
            uniform vec2 resolution;

            varying vec2 vUv;
            varying vec3 vPosition;

            // 3D Simplex noise (optimized)
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

                vec3 i  = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);

                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);

                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;

                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;

                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);

                vec4 x = x_ * ns.x + ns.yyyy;
                vec4 y = y_ * ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);

                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);

                vec4 s0 = floor(b0) * 2.0 + 1.0;
                vec4 s1 = floor(b1) * 2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));

                vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);

                vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;

                vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
            }

            // Fractional Brownian Motion for clouds
            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;

                for (int i = 0; i < 4; i++) {
                    value += amplitude * snoise(p * frequency);
                    frequency *= 2.0;
                    amplitude *= 0.5;
                }

                return value;
            }

            void main() {
                vec2 uv = vUv;

                // Animated cloud position
                vec3 cloudPos = vec3(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0);
                cloudPos.x += time * cloudSpeed * 0.05;

                // Generate cloud density using FBM
                float noise1 = fbm(cloudPos * 1.5 + vec3(time * 0.02, time * 0.01, 0.0));
                float noise2 = fbm(cloudPos * 3.0 - vec3(time * 0.03, 0.0, time * 0.02));

                // Combine noise layers
                float density = (noise1 * 0.7 + noise2 * 0.3 + 0.5) * cloudDensity;

                // Dynamic threshold based on cloud coverage
                // Low coverage (0-30%): High threshold = sparse wispy clouds
                // High coverage (70-100%): Low threshold = full cloud coverage
                // Adjusted formula to ensure clouds are visible even at low coverage
                float coverageThreshold = 0.45 - (cloudCoverage * 0.35); // 0.45 (sparse) to 0.10 (full)
                density = smoothstep(coverageThreshold, coverageThreshold + 0.35, density);

                // Add vertical gradient (more clouds at top)
                density *= smoothstep(0.0, 0.4, uv.y) * smoothstep(1.0, 0.6, uv.y);

                // Calculate cloud color with lighting
                vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
                float lightInfluence = fbm(cloudPos * 2.0 + lightDir) * 0.5 + 0.5;

                vec3 finalColor = mix(cloudShadowColor, cloudColor, lightInfluence);
                finalColor = mix(finalColor, sunColor, lightInfluence * 0.2);

                // Apply density to alpha
                float alpha = density * 0.85;

                gl_FragColor = vec4(finalColor, alpha);
            }
        `;

        this.cloudMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                time: { value: 0 },
                skyColor: { value: new THREE.Color(palette.skyColor) },
                cloudColor: { value: new THREE.Color(palette.cloudColor) },
                cloudShadowColor: { value: new THREE.Color(palette.cloudShadowColor) },
                sunColor: { value: new THREE.Color(palette.sunColor) },
                cloudDensity: { value: this.intensity },
                cloudCoverage: { value: this.cloudCover / 100 }, // Convert 0-100 to 0.0-1.0
                cloudSpeed: { value: this.running ? 1.0 : 0.0 },
                resolution: { value: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight) }
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }

    createCloudMesh() {
        // Create a plane that covers the viewport
        // Calculate plane size based on camera FOV and distance to ensure full coverage
        const distance = 7; // camera at z=5, plane at z=-2
        const vFOV = (this.camera.fov * Math.PI) / 180; // Convert to radians
        const planeHeight = 2 * Math.tan(vFOV / 2) * distance;
        const planeWidth = planeHeight * this.camera.aspect;

        // Add extra margin to ensure full coverage
        const geometry = new THREE.PlaneGeometry(planeWidth * 1.1, planeHeight * 1.1);
        this.cloudMesh = new THREE.Mesh(geometry, this.cloudMaterial);
        this.cloudMesh.position.z = -2;
        this.scene.add(this.cloudMesh);
    }

    getPalette() {
        const isDark = !isLightThemeMode();

        if (!isDark) {
            return {
                skyColor: 0xcadcf3,
                cloudColor: 0xb8b8b8,      // Light grey for better contrast
                cloudShadowColor: 0x788898, // Darker bluish grey for shadows
                sunColor: 0xffe3a0
            };
        }

        return {
            skyColor: 0x0a1628,
            cloudColor: 0x3c506e,
            cloudShadowColor: 0x192332,
            sunColor: 0x64788c
        };
    }

    animate = () => {
        if (!this.running) return;

        this.animationId = requestAnimationFrame(this.animate);
        this.time += 0.016; // ~60fps

        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.time.value = this.time;
        }

        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.running = true;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.cloudSpeed.value = 1.0;
        }
        this.animate();
    }

    pause() {
        this.running = false;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.cloudSpeed.value = 0.0;
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resume() {
        this.start();
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);

        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.resolution.value.set(width, height);
        }

        // Update cloud mesh geometry to match new aspect ratio
        if (this.cloudMesh) {
            const distance = 7;
            const vFOV = (this.camera.fov * Math.PI) / 180;
            const planeHeight = 2 * Math.tan(vFOV / 2) * distance;
            const planeWidth = planeHeight * this.camera.aspect;

            // Dispose old geometry and create new one with correct aspect ratio
            this.cloudMesh.geometry.dispose();
            this.cloudMesh.geometry = new THREE.PlaneGeometry(planeWidth * 1.1, planeHeight * 1.1);
        }
    }

    updateOptions(options) {
        if ('intensity' in options) {
            this.intensity = options.intensity;
            if (this.cloudMaterial) {
                this.cloudMaterial.uniforms.cloudDensity.value = this.intensity;
            }
        }
        if ('cloudCover' in options) {
            this.cloudCover = options.cloudCover;
            if (this.cloudMaterial) {
                this.cloudMaterial.uniforms.cloudCoverage.value = this.cloudCover / 100;
            }
        }
    }

    updateTheme() {
        const palette = this.getPalette();
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.skyColor.value.setHex(palette.skyColor);
            this.cloudMaterial.uniforms.cloudColor.value.setHex(palette.cloudColor);
            this.cloudMaterial.uniforms.cloudShadowColor.value.setHex(palette.cloudShadowColor);
            this.cloudMaterial.uniforms.sunColor.value.setHex(palette.sunColor);
        }
    }

    destroy() {
        this.pause();

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode === this.container) {
                this.container.removeChild(this.renderer.domElement);
            }
        }

        if (this.cloudMaterial) {
            this.cloudMaterial.dispose();
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cloudMaterial = null;
    }
}
