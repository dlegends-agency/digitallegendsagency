import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`

const frag = `
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.02 + vec2(1.7, 9.2); a *= .5; } return v; }
void main(){
  float asp = uRes.x/uRes.y;
  vec2 p = (vUv-.5)*vec2(asp,1.)*1.7;
  vec2 m = (uMouse-.5)*vec2(asp,1.)*1.7;
  float t = uTime*.07;
  float d = length(p-m);
  p += (p-m)*exp(-d*2.6)*.45;
  vec2 q = vec2(fbm(p+t), fbm(p+vec2(5.2,1.3)-t));
  vec2 r = vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*1.4), fbm(p+3.*q+vec2(8.3,2.8)-t));
  float f = fbm(p+3.*r);
  vec3 ink = vec3(.012,.016,.086);
  vec3 violet = vec3(.36,.14,.80);
  vec3 pink = vec3(.94,.23,.68);
  vec3 sky = vec3(.18,.48,1.);
  vec3 col = mix(ink, violet, smoothstep(.25,.75,f));
  col = mix(col, sky, smoothstep(.45,.9,r.x)*.7);
  col = mix(col, pink, smoothstep(.38,.95,q.y*f*3.2)*.95);
  float band = abs(fract(f*8.)-.5);
  col += vec3(.55,.45,1.)*smoothstep(.04,.0,band-.455)*.10;
  col = mix(col, ink, smoothstep(.5,.0,vUv.y)*.85);
  col *= smoothstep(1.6,.3,length(vUv-.5)*1.5);
  col += (hash(vUv*uRes + uTime) - .5) * .035;
  gl_FragColor = vec4(col, 1.);
}`

export default function Shader({ className = '' }) {
  const host = useRef(null)

  useEffect(() => {
    const el = host.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    } catch {
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = {
      uTime: { value: 12 }, uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.7, 0.5) },
    }
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms })
    const geo = new THREE.PlaneGeometry(2, 2)
    scene.add(new THREE.Mesh(geo, mat))

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el
      renderer.setSize(w, h, false)
      uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio())
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const target = new THREE.Vector2(0.7, 0.5)
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height)
    }
    window.addEventListener('pointermove', onMove)

    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
    io.observe(el)

    let raf
    const clock = new THREE.Clock()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden) return
      if (!reduce) uniforms.uTime.value += clock.getDelta()
      uniforms.uMouse.value.lerp(target, 0.05)
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      ro.disconnect(); io.disconnect()
      geo.dispose(); mat.dispose(); renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={host} className={className} aria-hidden="true" />
}
