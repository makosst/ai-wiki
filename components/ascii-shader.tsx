'use client';

import { useEffect, useRef } from 'react';
import {
  Camera,
  Mesh,
  Plane,
  Program,
  Renderer,
  RenderTarget,
} from 'ogl';

const vertexShader = `#version 300 es

in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.f, 1.f);
}`;

const sphereFragmentShader = `#version 300 es

precision highp float;

uniform float uTime;
uniform vec2 uResolution;

in vec2 vUv;

out vec4 fragColor;

void main() {
  // Normalize coordinates
  vec2 uv = (vUv - 0.5f) * 2.0f;
  uv.x *= uResolution.x / uResolution.y;

  // Calculate distance from center
  float dist = length(uv);
  vec3 col = vec3(1.0f);

  // Draw sphere using distance field
  if(dist < 1.0f) {
    // Calculate 3D position on sphere
    float z = sqrt(1.0f - dist * dist);
    vec3 normal = normalize(vec3(uv.x, uv.y, z));

    // Rotate normal
    float angle = uTime * 0.3f;
    float c = cos(angle);
    float s = sin(angle);
    vec3 rotatedNormal = vec3(
      normal.x * c - normal.z * s,
      normal.y,
      normal.x * s + normal.z * c
    );

    // Simple directional lighting
    vec3 lightDir = normalize(vec3(0.5f, 0.3f, 1.0f));
    float diff = dot(rotatedNormal, lightDir);

    // Soften the terminator with wrap lighting
    // This reduces the harsh line between light and shadow
    float wrap = 0.6f;
    float wrapDiff = max(0.0f, (diff + wrap) / (1.0f + wrap));

    // Map to narrow range - lifted minimum for lighter shadows
    float shade = wrapDiff * 0.25f + 0.48f;

    // Clamp to avoid extremes - higher minimum
    shade = clamp(shade, 0.48f, 0.73f);

    // Apply multiple smoothsteps for extra smooth transitions
    shade = smoothstep(0.48f, 0.73f, shade);
    shade = mix(0.48f, 0.73f, shade);

    col = vec3(shade);
  }

  fragColor = vec4(col, 1.0f);
}`;

const asciiVertexShader = `#version 300 es

in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0., 1.);
}`;

const asciiFragmentShader = `#version 300 es

precision highp float;

uniform vec2 uResolution;
uniform sampler2D uTexture;

out vec4 fragColor;

float character(int n, vec2 p) {
  p = floor(p * vec2(-4.0f, 4.0f) + 2.5f);
  if(clamp(p.x, 0.0f, 4.0f) == p.x) {
    if(clamp(p.y, 0.0f, 4.0f) == p.y) {
      int a = int(round(p.x) + 5.0f * round(p.y));
      if(((n >> a) & 1) == 1)
        return 1.0f;
    }
  }
  return 0.0f;
}

void main() {
  vec2 pix = gl_FragCoord.xy;
  vec2 blockSize = vec2(10.0f);
  vec2 blockCoord = floor(pix / blockSize) * blockSize;
  vec3 col = texture(uTexture, blockCoord / uResolution.xy).rgb;

  float gray = 0.299f * col.r + 0.587f * col.g + 0.114f * col.b;

  // Select character based on density
  int n = 4096;

  if(gray > 0.35f) n = 65600;
  if(gray > 0.40f) n = 163153;
  if(gray > 0.45f) n = 15255086;
  if(gray > 0.50f) n = 15255054;
  if(gray > 0.55f) n = 13121101;
  if(gray > 0.60f) n = 15252014;
  if(gray > 0.65f) n = 31599627;
  if(gray > 0.70f) n = 11512810;

  vec2 p = mod(pix / 5.0f, 2.0f) - vec2(1.0f);

  // If background (white), keep white
  if(gray > 0.85f) {
    fragColor = vec4(1.0f, 1.0f, 1.0f, 1.0f);
  } else {
    // Use character pattern as mask
    float charMask = character(n, p);

    // Map gray value to color range for smooth gradient
    // Darker areas = darker characters
    float colorValue = smoothstep(0.3f, 0.75f, gray);

    // Mix between white background and gray foreground based on character
    vec3 foreground = vec3(gray);
    vec3 background = vec3(1.0f);
    vec3 finalColor = mix(foreground, background, charMask);

    fragColor = vec4(finalColor, 1.0f);
  }
}`;

export function AsciiShader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize renderer with white background
    const renderer = new Renderer({
      dpr: 3,
      alpha: false
    });
    const gl = renderer.gl;
    gl.clearColor(1.0, 1.0, 1.0, 1.0); // White background
    canvasRef.current = gl.canvas as HTMLCanvasElement;
    containerRef.current.appendChild(gl.canvas);

    // Setup camera
    const camera = new Camera(gl, { near: 0.1, far: 100 });
    camera.position.set(0, 0, 3);

    // Create geometry (2D plane covering the screen)
    const geometry = new Plane(gl, {
      width: 2,
      height: 2,
    });

    // Create sphere shader program
    const sphereProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: sphereFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [0, 0] },
      },
    });

    // Create render target for sphere shader
    const renderTarget = new RenderTarget(gl);

    // Create ASCII shader program
    const asciiProgram = new Program(gl, {
      vertex: asciiVertexShader,
      fragment: asciiFragmentShader,
      uniforms: {
        uTexture: {
          value: renderTarget.texture,
        },
        uResolution: { value: [0, 0] },
      },
    });

    // Create meshes
    const sphereMesh = new Mesh(gl, { geometry, program: sphereProgram });
    const asciiMesh = new Mesh(gl, { geometry, program: asciiProgram });

    // Resize handler
    function resize() {
      const width = containerRef.current?.clientWidth || 400;
      const height = containerRef.current?.clientHeight || 400;
      renderer.setSize(width, height);
      camera.perspective({ aspect: width / height });
    }

    window.addEventListener('resize', resize);
    resize();

    // Animation loop
    let animationId: number;
    function update(t: number) {
      animationId = requestAnimationFrame(update);

      const elapsedTime = t * 0.001;
      sphereProgram.uniforms.uTime.value = elapsedTime;

      const width = gl.canvas.width;
      const height = gl.canvas.height;

      sphereProgram.uniforms.uResolution.value = [width, height];

      // Render sphere to texture
      renderer.render({ scene: sphereMesh, camera, target: renderTarget });

      // Render ASCII
      asciiProgram.uniforms.uResolution.value = [width, height];
      renderer.render({ scene: asciiMesh, camera });
    }

    animationId = requestAnimationFrame(update);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
      if (canvasRef.current && containerRef.current?.contains(canvasRef.current)) {
        containerRef.current.removeChild(canvasRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white"
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '400px',
      }}
    />
  );
}
