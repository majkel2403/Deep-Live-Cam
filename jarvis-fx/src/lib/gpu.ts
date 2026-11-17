/**
 * Renderer probe for the telemetry panel: reads the WebGL renderer string once through one throwaway
 * context, then releases it. Software rasterisers (SwiftShader, llvmpipe) are flagged so the FPS and
 * blocking readings are not mistaken for faults.
 */
export interface RendererInfo {
  renderer: string
  software: boolean
}

let cached: RendererInfo | null | undefined

export function rendererInfo(): RendererInfo | null {
  if (cached !== undefined) return cached
  cached = null
  if (typeof document === 'undefined') return cached
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGL2RenderingContext | null
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
      cached = { renderer, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer) }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    cached = null
  }
  return cached
}
