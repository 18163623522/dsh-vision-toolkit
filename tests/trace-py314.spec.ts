import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessService from '@deepseek-ai/dsh-subprocess-local'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'
import { bundledUpstreamRoot } from '../src/runtime-install.ts'
import { UpstreamAdapter } from '../src/upstream.ts'

const python = process.env.DSH_VISION_TRACE_PY314

describe.skipIf(python === undefined)('native trace on Python 3.14', () => {
  it('returns a real SVG through the pinned upstream CLI', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-vt-trace-py314-'))
    const ctx = new Context()
    try {
      await ctx.plugin(LocalSubprocessService)
      const adapter = new UpstreamAdapter(ctx, resolveConfig({ runtime: { mode: 'managed' } }), {
        source: 'managed',
        root: bundledUpstreamRoot(),
        python: { program: python!, prefix: [], display: python! },
        cleanHome: root,
        pythonVersion: '3.14.0',
        dependencies: { pillow: '12.3.0', numpy: '2.4.6', vtracer: '0.6.15' },
      })
      const output = join(root, 'trace.svg')
      const input = fileURLToPath(new URL('./fixtures/sample.png', import.meta.url))
      const result = await adapter.run('trace', [input, '--scale', '2', '-o', output], {
        signal: AbortSignal.timeout(30_000),
      })
      expect(result.outcome.exitCode, result.stderr).toBe(0)
      expect(result.stdout).toContain('wrote ')
      const svg = await readFile(output, 'utf8')
      expect(svg).toContain('<svg')
      expect(svg).toContain('<path')
    } finally {
      await ctx.fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })
})
