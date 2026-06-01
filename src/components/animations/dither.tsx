"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";

const DEFAULT_WAVE_COLOR: [number, number, number] = [1, 1, 1];

const vertexShader = `#version 300 es
precision highp float;
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;
uniform float colorNum;
uniform float pixelSize;

out vec4 outputColor;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

float bayer8(vec2 coord) {
  int x = int(mod(coord.x, 8.0));
  int y = int(mod(coord.y, 8.0));
  int index = y * 8 + x;

  if (index == 0) return 0.0 / 64.0;
  if (index == 1) return 48.0 / 64.0;
  if (index == 2) return 12.0 / 64.0;
  if (index == 3) return 60.0 / 64.0;
  if (index == 4) return 3.0 / 64.0;
  if (index == 5) return 51.0 / 64.0;
  if (index == 6) return 15.0 / 64.0;
  if (index == 7) return 63.0 / 64.0;
  if (index == 8) return 32.0 / 64.0;
  if (index == 9) return 16.0 / 64.0;
  if (index == 10) return 44.0 / 64.0;
  if (index == 11) return 28.0 / 64.0;
  if (index == 12) return 35.0 / 64.0;
  if (index == 13) return 19.0 / 64.0;
  if (index == 14) return 47.0 / 64.0;
  if (index == 15) return 31.0 / 64.0;
  if (index == 16) return 8.0 / 64.0;
  if (index == 17) return 56.0 / 64.0;
  if (index == 18) return 4.0 / 64.0;
  if (index == 19) return 52.0 / 64.0;
  if (index == 20) return 11.0 / 64.0;
  if (index == 21) return 59.0 / 64.0;
  if (index == 22) return 7.0 / 64.0;
  if (index == 23) return 55.0 / 64.0;
  if (index == 24) return 40.0 / 64.0;
  if (index == 25) return 24.0 / 64.0;
  if (index == 26) return 36.0 / 64.0;
  if (index == 27) return 20.0 / 64.0;
  if (index == 28) return 43.0 / 64.0;
  if (index == 29) return 27.0 / 64.0;
  if (index == 30) return 39.0 / 64.0;
  if (index == 31) return 23.0 / 64.0;
  if (index == 32) return 2.0 / 64.0;
  if (index == 33) return 50.0 / 64.0;
  if (index == 34) return 14.0 / 64.0;
  if (index == 35) return 62.0 / 64.0;
  if (index == 36) return 1.0 / 64.0;
  if (index == 37) return 49.0 / 64.0;
  if (index == 38) return 13.0 / 64.0;
  if (index == 39) return 61.0 / 64.0;
  if (index == 40) return 34.0 / 64.0;
  if (index == 41) return 18.0 / 64.0;
  if (index == 42) return 46.0 / 64.0;
  if (index == 43) return 30.0 / 64.0;
  if (index == 44) return 33.0 / 64.0;
  if (index == 45) return 17.0 / 64.0;
  if (index == 46) return 45.0 / 64.0;
  if (index == 47) return 29.0 / 64.0;
  if (index == 48) return 10.0 / 64.0;
  if (index == 49) return 58.0 / 64.0;
  if (index == 50) return 6.0 / 64.0;
  if (index == 51) return 54.0 / 64.0;
  if (index == 52) return 9.0 / 64.0;
  if (index == 53) return 57.0 / 64.0;
  if (index == 54) return 5.0 / 64.0;
  if (index == 55) return 53.0 / 64.0;
  if (index == 56) return 42.0 / 64.0;
  if (index == 57) return 26.0 / 64.0;
  if (index == 58) return 38.0 / 64.0;
  if (index == 59) return 22.0 / 64.0;
  if (index == 60) return 41.0 / 64.0;
  if (index == 61) return 25.0 / 64.0;
  if (index == 62) return 37.0 / 64.0;
  return 21.0 / 64.0;
}

vec3 dither(vec2 coord, vec3 color) {
  float threshold = bayer8(coord) - 0.25;
  float stepSize = 1.0 / (colorNum - 1.0);
  color += threshold * stepSize;
  color = clamp(color - 0.2, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 ditherCoord = floor(gl_FragCoord.xy / pixelSize);
  vec2 sampleCoord = ditherCoord * pixelSize;
  vec2 uv = sampleCoord / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

  float f = pattern(uv);
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }

  vec3 color = mix(vec3(0.0), waveColor, f);
  outputColor = vec4(dither(ditherCoord, color), 1.0);
}
`;

interface DitherSettings {
	waveSpeed: number;
	waveFrequency: number;
	waveAmplitude: number;
	waveColor: [number, number, number];
	colorNum: number;
	pixelSize: number;
	disableAnimation: boolean;
	enableMouseInteraction: boolean;
	mouseRadius: number;
	mouseX: number;
	mouseY: number;
}

export interface DitherProps {
	waveSpeed?: number;
	waveFrequency?: number;
	waveAmplitude?: number;
	waveColor?: [number, number, number];
	waveColorDark?: [number, number, number];
	colorNum?: number;
	pixelSize?: number;
	disableAnimation?: boolean;
	enableMouseInteraction?: boolean;
	mouseRadius?: number;
}

function createShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
) {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error("Could not create shader");
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
		gl.deleteShader(shader);
		throw new Error(message);
	}

	return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
	const program = gl.createProgram();
	if (!program) {
		throw new Error("Could not create WebGL program");
	}

	const vert = createShader(gl, gl.VERTEX_SHADER, vertexShader);
	const frag = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);

	gl.attachShader(program, vert);
	gl.attachShader(program, frag);
	gl.linkProgram(program);
	gl.deleteShader(vert);
	gl.deleteShader(frag);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) || "Unknown program error";
		gl.deleteProgram(program);
		throw new Error(message);
	}

	return program;
}

export function Dither({
	waveSpeed = 0.01,
	waveFrequency = 0,
	waveAmplitude = 0.18,
	waveColor = DEFAULT_WAVE_COLOR,
	waveColorDark = DEFAULT_WAVE_COLOR,
	colorNum = 2.5,
	pixelSize = 2,
	disableAnimation = false,
	enableMouseInteraction = false,
	mouseRadius = 1,
}: DitherProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const drawRef = useRef<() => void>(() => {});
	const { resolvedTheme } = useTheme();
	const activeColor = resolvedTheme === "dark" ? waveColorDark : waveColor;
	const settingsRef = useRef<DitherSettings>({
		waveSpeed,
		waveFrequency,
		waveAmplitude,
		waveColor: activeColor,
		colorNum,
		pixelSize,
		disableAnimation,
		enableMouseInteraction,
		mouseRadius,
		mouseX: 0,
		mouseY: 0,
	});

	settingsRef.current = {
		...settingsRef.current,
		waveSpeed,
		waveFrequency,
		waveAmplitude,
		waveColor: activeColor,
		colorNum,
		pixelSize,
		disableAnimation,
		enableMouseInteraction,
		mouseRadius,
	};

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext("webgl2", {
			antialias: false,
			preserveDrawingBuffer: false,
			powerPreference: "high-performance",
		});
		if (!gl) return;

		const program = createProgram(gl);
		const activateProgram = gl.useProgram.bind(gl);
		const positionBuffer = gl.createBuffer();
		if (!positionBuffer) {
			gl.deleteProgram(program);
			throw new Error("Could not create position buffer");
		}

		const positionLocation = gl.getAttribLocation(program, "position");
		const resolutionLocation = gl.getUniformLocation(program, "resolution");
		const timeLocation = gl.getUniformLocation(program, "time");
		const waveSpeedLocation = gl.getUniformLocation(program, "waveSpeed");
		const waveFrequencyLocation = gl.getUniformLocation(
			program,
			"waveFrequency",
		);
		const waveAmplitudeLocation = gl.getUniformLocation(
			program,
			"waveAmplitude",
		);
		const waveColorLocation = gl.getUniformLocation(program, "waveColor");
		const mousePosLocation = gl.getUniformLocation(program, "mousePos");
		const enableMouseLocation = gl.getUniformLocation(
			program,
			"enableMouseInteraction",
		);
		const mouseRadiusLocation = gl.getUniformLocation(program, "mouseRadius");
		const colorNumLocation = gl.getUniformLocation(program, "colorNum");
		const pixelSizeLocation = gl.getUniformLocation(program, "pixelSize");

		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			gl.STATIC_DRAW,
		);
		activateProgram(program);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		let animationFrame = 0;
		let disposed = false;
		let lastWidth = 0;
		let lastHeight = 0;
		const startedAt = performance.now();

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const width = Math.max(1, Math.floor(rect.width));
			const height = Math.max(1, Math.floor(rect.height));

			if (width === lastWidth && height === lastHeight) return;

			lastWidth = width;
			lastHeight = height;
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		};

		const draw = (now = performance.now()) => {
			const settings = settingsRef.current;
			resize();

			activateProgram(program);
			gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
			gl.uniform1f(
				timeLocation,
				settings.disableAnimation ? 0 : (now - startedAt) / 1000,
			);
			gl.uniform1f(waveSpeedLocation, settings.waveSpeed);
			gl.uniform1f(waveFrequencyLocation, settings.waveFrequency);
			gl.uniform1f(waveAmplitudeLocation, settings.waveAmplitude);
			gl.uniform3f(waveColorLocation, ...settings.waveColor);
			gl.uniform2f(mousePosLocation, settings.mouseX, settings.mouseY);
			gl.uniform1i(
				enableMouseLocation,
				settings.enableMouseInteraction ? 1 : 0,
			);
			gl.uniform1f(mouseRadiusLocation, settings.mouseRadius);
			gl.uniform1f(colorNumLocation, settings.colorNum);
			gl.uniform1f(pixelSizeLocation, settings.pixelSize);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		};

		const tick = (now: number) => {
			if (disposed) return;
			draw(now);

			const { disableAnimation, enableMouseInteraction } = settingsRef.current;
			if (!disableAnimation || enableMouseInteraction) {
				animationFrame = requestAnimationFrame(tick);
			}
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (!settingsRef.current.enableMouseInteraction) return;

			const rect = canvas.getBoundingClientRect();
			settingsRef.current.mouseX = event.clientX - rect.left;
			settingsRef.current.mouseY = event.clientY - rect.top;
			draw();
		};

		const resizeObserver = new ResizeObserver(() => draw());
		resizeObserver.observe(canvas);
		canvas.addEventListener("pointermove", handlePointerMove);
		drawRef.current = () => draw();

		animationFrame = requestAnimationFrame(tick);

		return () => {
			disposed = true;
			cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			canvas.removeEventListener("pointermove", handlePointerMove);
			gl.deleteBuffer(positionBuffer);
			gl.deleteProgram(program);
			drawRef.current = () => {};
		};
	}, []);

	useEffect(() => {
		drawRef.current();
	}, []);

	return <canvas ref={canvasRef} className="relative block h-full w-full" />;
}
