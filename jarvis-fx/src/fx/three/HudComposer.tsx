import { useMemo, type ReactElement } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { HalfFloatType, UnsignedByteType } from 'three'

/** True for software rasterisers (SwiftShader / llvmpipe), where half-float targets render black. */
function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    return /swiftshader|llvmpipe|software|basic render/i.test(renderer)
  } catch {
    return false
  }
}

/**
 * Shared post-processing wrapper for every R3F effect (Bloom, ChromaticAberration, Scanline, Glitch,
 * Noise, Vignette …). Picks a safe framebuffer type: HalfFloat on GPUs (better bloom), UnsignedByte
 * on software renderers. Usage:  <HudComposer><Bloom … /><Vignette … /></HudComposer>
 */
export function HudComposer({ children, enabled = true }: { children: ReactElement | ReactElement[]; enabled?: boolean }) {
  const gl = useThree((s) => s.gl)
  const type = useMemo(() => (isSoftwareRenderer(gl.getContext()) ? UnsignedByteType : HalfFloatType), [gl])
  return (
    <EffectComposer multisampling={0} frameBufferType={type} enabled={enabled}>
      {children}
    </EffectComposer>
  )
}
