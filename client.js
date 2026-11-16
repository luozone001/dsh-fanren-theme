/**
 * Client half of 凡人·朱煞 (Fanren · Crimson Omen).
 *
 * Three contributions, all owned by this module's Cordis context:
 *
 *  1. The "凡人·朱煞" palette, applied with `ctx.theme.overrideTokens` as a
 *     token layer over whatever theme the user picked. It never calls
 *     `setTheme`, so switching Appearance, fonts, or any other setting cannot
 *     silently turn it off, and switching it off restores the exact previous theme.
 *  2. A full-window wallpaper layer: one <video> behind the app shell playing
 *     the bundled crimson-aura clip, with an adjustable ink scrim and blur. The
 *     layer itself is DOM outside React by necessity — no DSH slot sits behind
 *     the three columns — so it is created and disposed inside one ctx.effect.
 *     It pauses in the background and honours prefers-reduced-motion (the poster
 *     stays as a still frame).
 *  3. A "凡人·朱煞" settings page (settings.section) with live controls and a
 *     preview that mirrors the scrim and blur.
 *
 * All user-visible copy goes through the client locale service. Wallpaper and
 * palette switches live in localStorage; the theme preference stays DSH's own.
 */
window.__ModuleLoader__.load({
  id: '@local/fanren-theme',
  factory(require) {
    const React = require('react')
    const { useEffect, useRef, useState, useSyncExternalStore } = React

    const THEME_ID = 'fanren'
    const NS = 'fanren-theme'
    const STORAGE_KEY = 'dsh-fanren-theme.settings.v1'
    const BASE_PATH = 'fanren-theme'
    const DEFAULTS = Object.freeze({ wallpaper: true, theme: true, dim: 0.46, blur: 6 })

    /** Palette: 墨底 + 朱砂 + 暗金 + 温白. Applied as a theme-token override layer. */
    const PALETTE = Object.freeze({
      '--dsw-alias-bg-base': 'rgba(12, 6, 9, 0.58)',
      '--dsw-alias-bg-layer-1': 'rgba(30, 13, 17, 0.72)',
      '--dsw-alias-bg-layer-2': 'rgba(40, 18, 22, 0.78)',
      '--dsw-alias-bg-layer-3': 'rgba(50, 23, 28, 0.84)',
      '--dsw-alias-bg-layer-4': 'rgba(62, 28, 33, 0.88)',
      '--dsw-alias-bg-mask-1': 'rgba(5, 2, 3, 0.62)',
      '--dsw-alias-bg-mask-2': 'rgba(5, 2, 3, 0.42)',
      '--dsw-alias-bg-mask-3': 'rgba(5, 2, 3, 0.26)',
      '--dsw-alias-bg-overlay': 'rgba(20, 8, 12, 0.96)',
      '--dsw-alias-border-selected': 'rgba(226, 102, 90, 0.55)',
      '--dsw-alias-settings-card-fill': 'rgba(34, 15, 19, 0.72)',
      '--dsw-alias-settings-card-stroke': 'rgba(236, 168, 152, 0.18)',
      '--dsw-alias-brand-text': '#f0998a',
      '--dsw-alias-button-elevated-fill': 'rgba(50, 23, 28, 0.90)',
      '--dsw-alias-button-floating-fill': 'rgba(20, 8, 12, 0.92)',
      '--dsw-alias-bg-skeleton': 'rgba(70, 30, 34, 0.45)',
      '--dsw-alias-bg-module-platform': 'rgba(22, 9, 13, 0.92)',
      '--dsw-alias-border-l1': 'rgba(236, 168, 152, 0.18)',
      '--dsw-alias-border-l2': 'rgba(236, 168, 152, 0.30)',
      '--dsw-alias-border-l3': 'rgba(236, 168, 152, 0.24)',
      '--dsw-alias-border-l4': 'rgba(236, 168, 152, 0.16)',
      '--dsw-alias-border-l2-darkmode-thin': 'rgba(236, 168, 152, 0.30)',
      '--dsw-alias-brand-primary': '#e2665a',
      '--dsw-alias-link': '#f0998a',
      '--dsw-alias-label-primary': '#f5ece5',
      '--dsw-alias-label-secondary': 'rgba(245, 236, 229, 0.72)',
      '--dsw-alias-label-tertiary': 'rgba(245, 236, 229, 0.55)',
      '--dsw-alias-label-caption': 'rgba(245, 236, 229, 0.50)',
      '--dsw-alias-label-dimmed': 'rgba(245, 236, 229, 0.40)',
      '--dsw-alias-label-primary-foreground': '#fff4ee',
      '--dsw-alias-label-error': '#ff9b8b',
      '--dsw-alias-label-shimmer': 'rgba(245, 236, 229, 0.60)',
      '--dsw-alias-state-error-primary': '#ef6d5c',
      '--dsw-alias-state-warn-primary': '#e7bf7c',
      '--dsw-alias-state-warn-label': '#f0cf98',
      '--dsw-alias-state-warn-tertiary': 'rgba(231, 191, 124, 0.35)',
      '--dsw-alias-state-success-primary': '#86c9a4',
      '--dsw-alias-state-success-tertiary': 'rgba(134, 201, 164, 0.35)',
      '--dsw-alias-state-idle-primary': '#b3928c',
      '--dsw-alias-state-business-primary': '#e2665a',
      '--dsw-alias-interactive-bg-hover': 'rgba(226, 102, 90, 0.10)',
      '--dsw-alias-interactive-bg-active': 'rgba(226, 102, 90, 0.16)',
      '--dsw-alias-interactive-bg-hover-danger': 'rgba(239, 109, 92, 0.14)',
      '--dsw-alias-hovercard-bg': 'rgba(24, 10, 14, 0.95)',
      '--dsw-alias-hovercard-label-primary': '#f5ece5',
      '--dsw-alias-tooltip-bg': 'rgba(24, 10, 14, 0.96)',
      '--dsw-alias-tooltip-label': '#f7efe8',
      '--dsw-alias-tooltip-key-bg': 'rgba(255, 255, 255, 0.10)',
      '--dsw-alias-toast-bg': 'rgba(28, 12, 16, 0.96)',
      '--dsw-alias-toast-label': '#f7efe8',
      '--dsw-alias-toast-action': '#f0998a',
      '--dsw-menu-surface-fill': 'rgba(20, 8, 12, 0.96)',
      '--dsw-specific-menu': 'rgba(20, 8, 12, 0.96)',
      '--dsw-specific-sidebar-fill': 'rgba(9, 4, 6, 0.62)',
      '--dsw-specific-sidebar-nav-item-active': 'rgba(226, 102, 90, 0.16)',
      '--dsw-specific-sidebar-nav-item-active-accent': '#e2665a',
      '--dsw-specific-sidebar-glass-fill': 'rgba(36, 16, 20, 0.55)',
      '--dsw-specific-sidebar-glass-hover': 'rgba(60, 26, 30, 0.45)',
      '--dsw-specific-sidebar-glass-collapsed-fill': 'rgba(36, 16, 20, 0.55)',
      '--dsw-specific-sidebar-glass-collapsed-hover': 'rgba(60, 26, 30, 0.45)',
      '--dsw-specific-bubble': 'rgba(52, 22, 26, 0.74)',
      '--dsw-specific-bubble-highlight': 'rgba(226, 102, 90, 0.18)',
      '--dsw-specific-input-major': 'rgba(16, 7, 10, 0.72)',
      '--dsw-specific-selector': 'rgba(30, 13, 17, 0.72)',
      '--dsw-specific-tip': 'rgba(28, 12, 16, 0.95)',
      '--dsw-alias-menu-icon': 'rgba(245, 236, 229, 0.62)',
      '--dsw-alias-menu-group-header-fill': 'rgba(245, 236, 229, 0.45)',
      '--dsw-alias-markdown-code-block': 'rgba(10, 4, 6, 0.78)',
      '--dsw-alias-markdown-code-block-banner': 'rgba(36, 16, 20, 0.90)',
      '--dsw-alias-markdown-inline-code': 'rgba(60, 26, 30, 0.70)',
      '--dsw-alias-markdown-tag': 'rgba(226, 102, 90, 0.16)',
      '--dsw-alias-switch-thumb': '#fbe9e2',
      '--dsw-alias-button-primary-fill': '#a63c34',
      '--dsw-alias-button-primary-hover': '#b8463c',
      '--dsw-alias-button-tool-bar-fill': 'rgba(255, 255, 255, 0.06)',
      '--dsw-alias-button-tool-bar-hover': 'rgba(255, 255, 255, 0.12)',
      '--dsw-alias-button-ghost-active-fill': 'rgba(226, 102, 90, 0.16)',
      '--dsw-alias-button-ghost-active-border': 'rgba(226, 102, 90, 0.40)',
      '--dsw-alias-scrollbar-bg-l2': 'rgba(236, 168, 152, 0.14)',
      '--dsw-alias-scrollbar-hover-l2': 'rgba(236, 168, 152, 0.28)',
      '--dsw-alias-code-diff-added': 'rgba(134, 201, 164, 0.16)',
      '--dsw-alias-code-diff-deleted': 'rgba(239, 109, 92, 0.16)',
      '--dsw-alias-file-diff-added-bg': 'rgba(134, 201, 164, 0.12)',
      '--dsw-alias-file-diff-deleted-bg': 'rgba(239, 109, 92, 0.12)',
      '--dsw-alias-json-tree-hover': 'rgba(226, 102, 90, 0.12)',
      '--dsw-alias-json-tree-keyword': '#f0998a',
      '--dsw-alias-json-tree-string': '#c9e0a8',
      '--dsw-alias-json-tree-number': '#e7bf7c',
      '--dsw-alias-json-tree-property': '#f5ece5',
      '--dsw-alias-json-tree-punctuation': 'rgba(245, 236, 229, 0.55)',
      '--dsw-focus-ring-color': '#e2665a',
    })

    /** The same palette as an override layer (both palette modes share these dark values). */
    const PALETTE_LAYER = Object.freeze(Object.fromEntries(
      Object.entries(PALETTE).map(([name, value]) => [name, { light: value, dark: value }]),
    ))

    /** Locale dictionaries: both baseline locales are required by the service. */
    const DICT = Object.freeze({
      zh: {
        nav: '凡人·朱煞',
        title: '凡人·朱煞',
        subtitle: '朱砂煞气漫过墨色山影，化作 DSH 的整幅动态壁纸与配色。',
        wallpaper: '动态壁纸',
        wallpaperDesc: '在对话界面后方循环播放本地仙侠视频；隐藏在后台时暂停，系统开启「减少动态效果」时只显示静帧。',
        wallpaperNeedsPalette: '壁纸位于界面之后；凡人配色关闭时，宿主的默认不透明界面会遮住它。',
        wallpaperOn: '已开启',
        wallpaperOff: '已关闭',
        preview: '壁纸预览',
        previewOff: '壁纸已关闭；预览仍可单独播放，用来看画面与调效果。',
        dim: '墨色遮罩',
        dimDesc: '加深画面暗部，保证文字可读。',
        blur: '景深模糊',
        blurDesc: '柔化背景细节；0 为原片清晰度。',
        theme: '凡人配色',
        themeDesc: '叠加「凡人·朱煞」配色层：朱砂主色、墨玉玻璃与温白文字。它不改变你的外观主题设置，关闭后立即回到原来的主题。',
        status: '壁纸文件',
        statusOk: '就绪 · {size} MB',
        statusMissing: '宿主未找到壁纸素材，当前仅启用配色',
        statusError: '宿主请求失败，暂时读不到壁纸素材',
        statusLoading: '正在检查…',
        reset: '恢复默认设置',
        resetDone: '已恢复默认设置',
        footer: '壁纸与配色开关保存在当前浏览器（localStorage），每次加载时恢复；外观里的浅色/深色偏好不会被本插件修改。浏览器禁用本地存储时，设置只在本次页面有效。',
        previewBadge: '静音循环',
        previewPlay: '播放预览',
        previewPause: '暂停预览',
        previewError: '浏览器无法解码这段视频，已回退到海报图。',
      },
      en: {
        nav: 'Fanren · Crimson Omen',
        title: 'Fanren · Crimson Omen',
        subtitle: 'Crimson aura over ink-dark peaks, as a full-window wallpaper and palette for DSH.',
        wallpaper: 'Motion wallpaper',
        wallpaperDesc: 'Loops the bundled xianxia clip behind the chat, pauses in the background, and shows a still frame when the system asks for reduced motion.',
        wallpaperNeedsPalette: 'The wallpaper sits behind the UI; with the Fanren palette off, the host\'s opaque default surfaces cover it.',
        wallpaperOn: 'On',
        wallpaperOff: 'Off',
        preview: 'Wallpaper preview',
        previewOff: 'The wallpaper is off; the preview can still play on its own to check the picture and tuning.',
        dim: 'Ink scrim',
        dimDesc: 'Darkens the image so text stays readable.',
        blur: 'Depth blur',
        blurDesc: 'Softens background detail; 0 keeps the source sharp.',
        theme: 'Fanren palette',
        themeDesc: 'Stacks the Fanren · Crimson Omen palette layer: vermilion accents, ink-jade glass, warm-white text. It never changes your Appearance theme, and turning it off restores that theme instantly.',
        status: 'Wallpaper file',
        statusOk: 'Ready · {size} MB',
        statusMissing: 'The host cannot find the wallpaper assets; only the palette is active',
        statusError: 'The host request failed; the wallpaper assets cannot be read right now',
        statusLoading: 'Checking…',
        reset: 'Restore default settings',
        resetDone: 'Defaults restored',
        footer: 'Wallpaper and palette switches live in this browser (localStorage) and are restored on each load; the light/dark Appearance preference is never changed by this plugin. Without local storage, settings last for this page only.',
        previewBadge: 'Muted loop',
        previewPlay: 'Play preview',
        previewPause: 'Pause preview',
        previewError: 'This browser cannot decode the clip; the poster is shown instead.',
      },
    })

    /** Global stylesheet: the wallpaper layer + the app-shell stacking order. */
    const GLOBAL_CSS = `
      html[data-fanren-active],
      html[data-fanren-active] body {
        background-color: #0a0406;
        background-image: radial-gradient(ellipse at 50% 0%, #1a0b0f, #070304 68%);
      }
      /* The palette is a dark token layer even when the base preference is light;
         keep native controls on the same side. */
      html[data-fanren-palette] { color-scheme: dark !important; }
      html[data-fanren-active] #root { position: relative; z-index: 1; }
      .fanren-wallpaper {
        position: fixed;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        background: #0a0406;
      }
      .fanren-wallpaper__video {
        position: absolute;
        inset: -2%;
        width: 104%;
        height: 104%;
        object-fit: cover;
        filter: blur(var(--fanren-blur, 6px)) saturate(1.04) brightness(0.94);
        transform: translateZ(0);
      }
      .fanren-wallpaper__scrim {
        position: absolute;
        inset: 0;
        opacity: var(--fanren-dim, 0.46);
        background:
          radial-gradient(ellipse at 50% 42%, rgba(5, 1, 3, 0.38), rgba(3, 1, 2, 0.94) 78%),
          linear-gradient(180deg, rgba(3, 1, 2, 0.30), rgba(3, 1, 2, 0.62));
      }
      .fanren-wallpaper__tint {
        position: absolute;
        inset: 0;
        mix-blend-mode: screen;
        opacity: 0.55;
        background:
          radial-gradient(ellipse at 54% 104%, rgba(196, 58, 48, 0.30), transparent 58%),
          radial-gradient(ellipse at 22% 8%, rgba(120, 52, 54, 0.20), transparent 46%);
      }
      .fanren-wallpaper[data-failed] .fanren-wallpaper__video { visibility: hidden; }
      @media (prefers-reduced-motion: reduce) {
        .fanren-wallpaper__video { transition: none; }
      }
    `

    /* ------------------------------------------------------------------ */
    /* Settings store (localStorage-backed, cross-window via storage event) */
    /* ------------------------------------------------------------------ */

    function clamp01(value, fallback) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(0.85, Math.max(0, number))
    }

    function clampBlur(value, fallback) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(24, Math.max(0, Math.round(number)))
    }

    function normalizeSettings(raw) {
      if (raw === null || typeof raw !== 'object') return { ...DEFAULTS }
      return {
        wallpaper: typeof raw.wallpaper === 'boolean' ? raw.wallpaper : DEFAULTS.wallpaper,
        theme: typeof raw.theme === 'boolean' ? raw.theme : DEFAULTS.theme,
        dim: clamp01(raw.dim, DEFAULTS.dim),
        blur: clampBlur(raw.blur, DEFAULTS.blur),
      }
    }

    function createSettingsStore() {
      let state = read()
      const listeners = new Set()

      function read() {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          if (raw !== null) return normalizeSettings(JSON.parse(raw))
        } catch { /* storage unavailable or corrupt: fall through to defaults */ }
        return { ...DEFAULTS }
      }

      function persist(next) {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* memory-only */ }
      }

      return {
        get: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        set(patch) {
          const next = normalizeSettings({ ...state, ...patch })
          const previous = state
          if (next.wallpaper === previous.wallpaper && next.theme === previous.theme
            && next.dim === previous.dim && next.blur === previous.blur) return
          state = next
          persist(next)
          for (const listener of [...listeners]) listener(state, previous)
        },
        reset() {
          this.set({ ...DEFAULTS })
        },
        /** Adopt a value another window wrote; never writes back. */
        adoptExternal(raw) {
          const next = normalizeSettings(raw)
          const previous = state
          if (next.wallpaper === previous.wallpaper && next.theme === previous.theme
            && next.dim === previous.dim && next.blur === previous.blur) return
          state = next
          for (const listener of [...listeners]) listener(state, previous)
        },
        reload: read,
      }
    }

    /** Resolve a package route against the document base, honouring a public-URL prefix. */
    function assetUrl(relative) {
      try { return new URL(relative, document.baseURI).href } catch { return `/${relative}` }
    }

    /* --------------------------- */
    /* Wallpaper layer controller  */
    /* --------------------------- */

    function createWallpaperController(settings) {
      let layer = null
      let gestureBound = false
      let disposed = false
      let videoError = false
      let gestureCleanup = null
      const videoUrl = assetUrl(`${BASE_PATH}/wallpaper.mp4`)
      const posterUrl = assetUrl(`${BASE_PATH}/poster.jpg`)
      const motionQuery = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null
      let reducedMotion = motionQuery !== null && motionQuery.matches === true

      function tryPlay() {
        if (layer === null) return
        if (document.hidden || reducedMotion) {
          layer.video.pause()
          return
        }
        const promise = layer.video.play()
        if (promise !== undefined && typeof promise.catch === 'function') {
          promise.catch(() => { bindGestureRetry() })
        }
      }

      function bindGestureRetry() {
        if (gestureBound) return
        gestureBound = true
        const retry = () => {
          unbind()
          tryPlay()
        }
        const unbind = () => {
          gestureBound = false
          gestureCleanup = null
          window.removeEventListener('pointerdown', retry, true)
          window.removeEventListener('keydown', retry, true)
        }
        gestureCleanup = unbind
        window.addEventListener('pointerdown', retry, true)
        window.addEventListener('keydown', retry, true)
      }

      function ensureLayer() {
        if (layer !== null) return layer
        const root = document.createElement('div')
        root.className = 'fanren-wallpaper'
        root.setAttribute('data-fanren-wallpaper', '')
        root.setAttribute('aria-hidden', 'true')

        const video = document.createElement('video')
        video.className = 'fanren-wallpaper__video'
        video.muted = true
        video.defaultMuted = true
        video.loop = true
        video.autoplay = false
        video.playsInline = true
        video.preload = reducedMotion ? 'metadata' : 'auto'
        video.setAttribute('muted', '')
        video.setAttribute('playsinline', '')
        video.setAttribute('webkit-playsinline', '')
        video.setAttribute('disableremoteplayback', '')
        video.poster = posterUrl
        video.src = videoUrl
        video.addEventListener('error', () => {
          videoError = true
          root.setAttribute('data-failed', '')
          root.style.backgroundImage = `url("${posterUrl}")`
          root.style.backgroundSize = 'cover'
          root.style.backgroundPosition = 'center'
        })

        const scrim = document.createElement('div')
        scrim.className = 'fanren-wallpaper__scrim'
        const tint = document.createElement('div')
        tint.className = 'fanren-wallpaper__tint'

        root.append(video, scrim, tint)
        document.body.insertBefore(root, document.body.firstChild)
        layer = { root, video }
        tryPlay()
        return layer
      }

      function destroyLayer() {
        if (gestureCleanup !== null) gestureCleanup()
        if (layer === null) return
        try {
          layer.video.pause()
          layer.video.removeAttribute('src')
          layer.video.load()
        } catch { /* ignore */ }
        layer.root.remove()
        layer = null
      }

      function sync() {
        const current = settings.get()
        if (!current.wallpaper) {
          destroyLayer()
          return
        }
        const mounted = ensureLayer()
        mounted.root.style.setProperty('--fanren-dim', String(current.dim))
        mounted.root.style.setProperty('--fanren-blur', `${current.blur}px`)
        tryPlay()
      }

      /** Snapshot used by the read-only diagnostics report. */
      function status() {
        if (layer === null) return { mounted: false, video: 'off' }
        if (videoError) return { mounted: true, video: 'error' }
        if (layer.video.readyState >= 3) return { mounted: true, video: layer.video.paused ? 'paused' : 'ready' }
        return { mounted: true, video: 'loading' }
      }

      const offSettings = settings.subscribe(() => { sync() })
      const onVisibility = () => {
        if (layer === null) return
        if (document.hidden) layer.video.pause()
        else tryPlay()
      }
      document.addEventListener('visibilitychange', onVisibility)
      const onMotionChange = event => {
        reducedMotion = event.matches
        if (reducedMotion) layer?.video.pause()
        else tryPlay()
      }
      motionQuery?.addEventListener('change', onMotionChange)

      return {
        start: sync,
        status,
        dispose() {
          disposed = true
          offSettings()
          document.removeEventListener('visibilitychange', onVisibility)
          motionQuery?.removeEventListener('change', onMotionChange)
          if (gestureCleanup !== null) gestureCleanup()
          destroyLayer()
        },
        get mounted() { return !disposed && layer !== null },
      }
    }

    /* -------------------------------- */
    /* Settings section React component */
    /* -------------------------------- */

    const SECTION_CSS = `
      .fanren-page {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 4px 0 32px;
        max-width: 720px;
        color: var(--dsw-alias-label-primary);
      }
      .fanren-page__head { display: flex; flex-direction: column; gap: 6px; }
      .fanren-page__title { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.02em; }
      .fanren-page__subtitle { margin: 0; font-size: 12.5px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .fanren-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px 18px;
        border-radius: var(--dsw-radius-lg);
        border: 0.5px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-1);
      }
      .fanren-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .fanren-row__text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .fanren-row__label { font-size: 13px; font-weight: 500; }
      .fanren-row__desc { font-size: 12px; line-height: 17px; color: var(--dsw-alias-label-secondary); }
      .fanren-switch {
        flex: none;
        position: relative;
        width: 40px;
        height: 22px;
        padding: 0;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        background: var(--dsw-alias-border-l2);
        transition: background var(--ds-transition-duration-fast, 0.1s) ease;
      }
      .fanren-switch[aria-checked='true'] { background: var(--dsw-alias-button-primary-fill); }
      .fanren-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--dsw-alias-switch-thumb);
        transition: transform var(--ds-transition-duration-fast, 0.1s) ease;
      }
      .fanren-switch[aria-checked='true']::after { transform: translateX(18px); }
      .fanren-switch:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 2px; }
      .fanren-slider { display: flex; flex-direction: column; gap: 8px; }
      .fanren-slider__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .fanren-slider__value { font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
      .fanren-slider input[type='range'] {
        width: 100%;
        accent-color: var(--dsw-alias-brand-primary);
        cursor: pointer;
      }
      .fanren-slider input[type='range']:disabled { opacity: 0.45; cursor: not-allowed; }
      .fanren-preview {
        position: relative;
        width: 100%;
        max-width: 420px;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: var(--dsw-radius-md);
        border: 0.5px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-base);
      }
      .fanren-preview__stage { position: absolute; inset: 0; overflow: hidden; }
      .fanren-preview video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(var(--fanren-preview-blur, 6px)) saturate(1.04) brightness(0.94);
        transform: scale(1.06);
      }
      .fanren-preview__scrim {
        position: absolute;
        inset: 0;
        opacity: var(--fanren-preview-dim, 0.46);
        background:
          radial-gradient(ellipse at 50% 42%, rgba(5, 1, 3, 0.38), rgba(3, 1, 2, 0.94) 78%),
          linear-gradient(180deg, rgba(3, 1, 2, 0.30), rgba(3, 1, 2, 0.62));
      }
      .fanren-preview[data-off] .fanren-preview__stage { opacity: 0.45; }
      .fanren-preview__badge {
        position: absolute;
        right: 8px;
        bottom: 8px;
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 10.5px;
        letter-spacing: 0.02em;
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-layer-3);
        border: 0.5px solid var(--dsw-alias-border-l1);
      }
      .fanren-note { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-tertiary); }
      .fanren-status { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
      .fanren-status__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
      .fanren-status[data-state='ok'] .fanren-status__dot { background: var(--dsw-alias-state-success-primary); }
      .fanren-status[data-state='missing'] .fanren-status__dot { background: var(--dsw-alias-state-warn-primary); }
      .fanren-status[data-state='error'] .fanren-status__dot { background: var(--dsw-alias-state-error-primary); }
      .fanren-preview__toggle {
        position: absolute;
        left: 8px;
        bottom: 8px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 10.5px;
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-layer-3);
        border: 0.5px solid var(--dsw-alias-border-l1);
        cursor: pointer;
      }
      .fanren-preview__toggle:hover { background: var(--dsw-alias-bg-layer-4); }
      .fanren-preview__toggle:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 2px; }
      .fanren-actions { display: flex; align-items: center; gap: 10px; }
      .fanren-button {
        padding: 5px 12px;
        border-radius: var(--dsw-radius-sm);
        border: 0.5px solid var(--dsw-alias-border-l2);
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        cursor: pointer;
      }
      .fanren-button:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .fanren-button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 2px; }
      .fanren-toast { font-size: 11.5px; color: var(--dsw-alias-state-success-primary); }
      .fanren-footer { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-tertiary); }
    `

    /** Section navigation glyph, drawn with currentColor so the shell owns its states. */
    function FanrenNavIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 20
      return React.createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, focusable: false,
      },
        React.createElement('path', {
          d: 'M3 19.5 9.2 7.4l3.4 6 2.2-3.8 4.6 9.9H3Z',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', fill: 'none',
        }),
        React.createElement('circle', { cx: 16.4, cy: 6.4, r: 2.5, stroke: 'currentColor', strokeWidth: 1.5 }),
      )
    }

    function useStore(store) {
      return useSyncExternalStore(store.subscribe, store.get, store.get)
    }

    /** Build the settings section component so it closes over ctx and the store. */
    function createSettingsSection(ctx, store, t) {
      const videoUrl = assetUrl(`${BASE_PATH}/wallpaper.mp4`)
      const posterUrl = assetUrl(`${BASE_PATH}/poster.jpg`)
      const statusUrl = assetUrl(`${BASE_PATH}/status`)
      const reducedMotion = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches

      function Switch(props) {
        return React.createElement('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          className: 'fanren-switch',
          onClick: () => { props.onChange(!props.checked) },
        })
      }

      function Slider(props) {
        return React.createElement('div', { className: 'fanren-slider' },
          React.createElement('div', { className: 'fanren-slider__head' },
            React.createElement('span', { className: 'fanren-row__label' }, props.label),
            React.createElement('span', { className: 'fanren-slider__value' }, props.display),
          ),
          React.createElement('input', {
            type: 'range',
            min: props.min,
            max: props.max,
            step: props.step,
            value: props.value,
            disabled: props.disabled === true,
            'aria-label': props.label,
            'aria-valuetext': props.display,
            onChange: event => { props.onInput(Number(event.target.value)) },
          }),
          React.createElement('span', { className: 'fanren-row__desc' }, props.desc),
        )
      }

      return function FanrenSection() {
        const settings = useStore(store)
        // Subscribing to the locale snapshot makes copy follow a language switch live.
        useSyncExternalStore(
          callback => ctx.locale.subscribe(callback),
          () => ctx.locale.getLocale(),
          () => ctx.locale.getLocale(),
        )
        const [status, setStatus] = useState({ state: 'loading' })
        const [toast, setToast] = useState('')
        const [previewPlaying, setPreviewPlaying] = useState(!reducedMotion)
        const [previewError, setPreviewError] = useState(false)
        const toastTimer = useRef(null)
        const previewRef = useRef(null)

        useEffect(() => {
          let cancelled = false
          fetch(statusUrl, { cache: 'no-store', credentials: 'same-origin' })
            .then(response => {
              if (response.status === 404) return { missing: true }
              if (!response.ok) throw new Error(String(response.status))
              return response.json()
            })
            .then(payload => {
              if (cancelled) return
              if (payload !== null && payload.missing === true) { setStatus({ state: 'missing' }); return }
              const bytes = payload?.files?.[`/${BASE_PATH}/wallpaper.mp4`]?.bytes
              if (typeof bytes === 'number' && bytes > 0) setStatus({ state: 'ok', bytes })
              else setStatus({ state: 'missing' })
            })
            .catch(() => { if (!cancelled) setStatus({ state: 'error' }) })
          return () => { cancelled = true }
        }, [])

        useEffect(() => () => {
          if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
        }, [])

        // Turning the wallpaper off also stops its preview, and turning it back
        // on resumes it (unless the system asked for reduced motion).
        useEffect(() => {
          setPreviewPlaying(settings.wallpaper && !reducedMotion)
        }, [settings.wallpaper])

        // Manual play/pause always wins over the reduced-motion default.
        useEffect(() => {
          const video = previewRef.current
          if (video === null) return
          if (!previewPlaying) {
            video.pause()
            return
          }
          const promise = video.play()
          if (promise !== undefined && typeof promise.catch === 'function') {
            promise.catch(() => { setPreviewPlaying(false) })
          }
        }, [previewPlaying])

        const flash = message => {
          setToast(message)
          if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
          toastTimer.current = window.setTimeout(() => { setToast('') }, 2400)
        }

        const statusSize = status.state === 'ok' ? (status.bytes / (1024 * 1024)).toFixed(1) : ''
        const statusText = status.state === 'loading'
          ? t('statusLoading')
          : status.state === 'ok'
            ? t('statusOk', { size: statusSize })
            : status.state === 'missing' ? t('statusMissing') : t('statusError')

        const previewStyle = {
          '--fanren-preview-dim': String(settings.dim),
          '--fanren-preview-blur': `${settings.blur}px`,
        }

        return React.createElement('div', { className: 'fanren-page' },
          React.createElement('style', null, SECTION_CSS),
          React.createElement('header', { className: 'fanren-page__head' },
            React.createElement('h2', { className: 'fanren-page__title' }, t('title')),
            React.createElement('p', { className: 'fanren-page__subtitle' }, t('subtitle')),
          ),

          React.createElement('section', { className: 'fanren-card', 'aria-label': t('wallpaper') },
            React.createElement('div', { className: 'fanren-row' },
              React.createElement('div', { className: 'fanren-row__text' },
                React.createElement('span', { className: 'fanren-row__label' }, t('wallpaper')),
                React.createElement('span', { className: 'fanren-row__desc' }, t('wallpaperDesc')),
              ),
              React.createElement(Switch, {
                checked: settings.wallpaper,
                label: t('wallpaper'),
                onChange: value => { store.set({ wallpaper: value }) },
              }),
            ),
            React.createElement('div', {
              className: 'fanren-preview',
              style: previewStyle,
              'data-off': settings.wallpaper ? undefined : '',
            },
              React.createElement('div', { className: 'fanren-preview__stage' },
                React.createElement('video', {
                  ref: previewRef,
                  src: videoUrl,
                  poster: posterUrl,
                  muted: true,
                  loop: true,
                  playsInline: true,
                  preload: 'metadata',
                  onError: () => { setPreviewError(true) },
                  'aria-label': t('preview'),
                }),
                React.createElement('div', { className: 'fanren-preview__scrim', 'aria-hidden': true }),
              ),
              React.createElement('button', {
                type: 'button',
                className: 'fanren-preview__toggle',
                onClick: () => { setPreviewPlaying(playing => !playing) },
                'aria-label': previewPlaying ? t('previewPause') : t('previewPlay'),
              }, previewPlaying ? t('previewPause') : t('previewPlay')),
              React.createElement('span', { className: 'fanren-preview__badge' }, t('previewBadge')),
            ),
            previewError ? React.createElement('span', { className: 'fanren-note' }, t('previewError')) : null,
            settings.wallpaper ? null : React.createElement('span', { className: 'fanren-note' }, t('previewOff')),
            settings.wallpaper && !settings.theme
              ? React.createElement('span', { className: 'fanren-note' }, t('wallpaperNeedsPalette'))
              : null,
            React.createElement(Slider, {
              label: t('dim'),
              desc: t('dimDesc'),
              min: 0,
              max: 0.85,
              step: 0.01,
              value: settings.dim,
              display: `${Math.round(settings.dim * 100)}%`,
              disabled: !settings.wallpaper,
              onInput: value => { store.set({ dim: value }) },
            }),
            React.createElement(Slider, {
              label: t('blur'),
              desc: t('blurDesc'),
              min: 0,
              max: 24,
              step: 1,
              value: settings.blur,
              display: `${settings.blur}px`,
              disabled: !settings.wallpaper,
              onInput: value => { store.set({ blur: value }) },
            }),
            React.createElement('div', {
              className: 'fanren-status',
              'data-state': status.state,
              role: 'status',
              'aria-live': 'polite',
            },
              React.createElement('span', { className: 'fanren-status__dot', 'aria-hidden': true }),
              React.createElement('span', null, `${t('status')} · ${statusText}`),
            ),
          ),

          React.createElement('section', { className: 'fanren-card', 'aria-label': t('theme') },
            React.createElement('div', { className: 'fanren-row' },
              React.createElement('div', { className: 'fanren-row__text' },
                React.createElement('span', { className: 'fanren-row__label' }, t('theme')),
                React.createElement('span', { className: 'fanren-row__desc' }, t('themeDesc')),
              ),
              React.createElement(Switch, {
                checked: settings.theme,
                label: t('theme'),
                onChange: value => { store.set({ theme: value }) },
              }),
            ),
          ),

          React.createElement('div', { className: 'fanren-actions' },
            React.createElement('button', {
              type: 'button',
              className: 'fanren-button',
              onClick: () => { store.reset(); flash(t('resetDone')) },
            }, t('reset')),
            toast ? React.createElement('span', { className: 'fanren-toast', role: 'status' }, toast) : null,
          ),

          React.createElement('p', { className: 'fanren-footer' }, t('footer')),
        )
      }
    }

    /* -------------------------------- */
    /* Palette + plugin entry          */
    /* -------------------------------- */

    return {
      inject: ['slots', 'theme', 'locale'],

      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }),
          'fanren-theme: locale dictionaries',
        )
        // A bound translator resolves the active locale on every call; the
        // section re-renders through its locale subscription below.
        const t = ctx.locale.bind(NS)

        const store = createSettingsStore()
        let wallpaperController = null
        let paletteActive = false
        let reportTimer = null

        /**
         * Send one short state snapshot to the host's read-only status route
         * (diagnostics only). Debounced; every failure is ignored.
         */
        const reportClientState = () => {
          if (reportTimer !== null) window.clearTimeout(reportTimer)
          reportTimer = window.setTimeout(() => {
            reportTimer = null
            try {
              const url = new URL(`${BASE_PATH}/status`, document.baseURI)
              const video = wallpaperController === null ? { mounted: false, video: 'none' } : wallpaperController.status()
              url.searchParams.set('report', '1')
              url.searchParams.set('theme', store.get().theme ? 'on' : 'off')
              url.searchParams.set('palette', paletteActive ? '1' : '0')
              url.searchParams.set('preference', ctx.theme.getTheme().preference)
              url.searchParams.set('wallpaper', store.get().wallpaper ? 'on' : 'off')
              url.searchParams.set('mounted', video.mounted ? '1' : '0')
              url.searchParams.set('video', video.video)
              url.searchParams.set('viewport', `${window.innerWidth}x${window.innerHeight}`)
              fetch(url, { cache: 'no-store', credentials: 'same-origin' }).catch(() => {})
            } catch { /* diagnostics only */ }
          }, 700)
        }
        ctx.effect(() => {
          const timer = window.setTimeout(reportClientState, 1500)
          const offStore = store.subscribe(() => { reportClientState() })
          return () => {
            window.clearTimeout(timer)
            offStore()
            if (reportTimer !== null) { window.clearTimeout(reportTimer); reportTimer = null }
          }
        }, 'fanren-theme: diagnostics report')

        // Global stylesheet (wallpaper layer, ink base, stacking order).
        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-fanren-theme', '')
          style.textContent = GLOBAL_CSS
          document.head.append(style)
          return () => { style.remove() }
        }, 'fanren-theme: global stylesheet')

        // Wallpaper layer controller.
        ctx.effect(() => {
          const controller = createWallpaperController(store)
          wallpaperController = controller
          controller.start()
          return () => {
            controller.dispose()
            wallpaperController = null
          }
        }, 'fanren-theme: wallpaper layer')

        // Palette layer. `overrideTokens` never writes the user's theme
        // preference, so Appearance, fonts, or any other settings write cannot
        // switch this palette off behind the user's back, and turning it off
        // restores the exact theme that was in use before.
        ctx.effect(() => {
          let layer = null
          const sync = () => {
            if (store.get().theme) {
              if (layer === null) {
                try { layer = ctx.theme.overrideTokens('@local/fanren-theme', PALETTE_LAYER); paletteActive = true }
                catch (error) { console.warn('[fanren-theme] could not apply palette', error) }
              }
            } else if (layer !== null) {
              layer()
              layer = null
              paletteActive = false
            }
          }
          const offSettings = store.subscribe((next, previous) => {
            if (next.theme !== previous.theme) sync()
          })
          const offTheme = ctx.on('theme/change', () => { reportClientState() })
          sync()
          return () => {
            offSettings()
            offTheme()
            if (layer !== null) layer()
            paletteActive = false
          }
        }, 'fanren-theme: palette layer')

        // Publish which global surfaces are active: the ink base and stacking
        // fix exist while either the wallpaper or the palette is on, while the
        // native dark scheme belongs to the palette alone.
        ctx.effect(() => {
          const root = document.documentElement
          const sync = () => {
            const current = store.get()
            if (current.wallpaper || current.theme) root.setAttribute('data-fanren-active', '')
            else root.removeAttribute('data-fanren-active')
            if (current.theme) root.setAttribute('data-fanren-palette', '')
            else root.removeAttribute('data-fanren-palette')
          }
          const offSettings = store.subscribe(() => { sync() })
          sync()
          return () => {
            offSettings()
            root.removeAttribute('data-fanren-active')
            root.removeAttribute('data-fanren-palette')
          }
        }, 'fanren-theme: global surface state')

        // Settings page (one nav entry) + its nav glyph.
        const Section = createSettingsSection(ctx, store, t)
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: THEME_ID,
          order: 25,
          label: () => t('nav'),
        }, Section))

        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon', id: THEME_ID,
        }, FanrenNavIcon))

        // Keep other windows/tabs of the same origin in step.
        ctx.effect(() => {
          const onStorage = event => {
            if (event.key !== STORAGE_KEY || event.newValue === null) return
            try { store.adoptExternal(JSON.parse(event.newValue)) } catch { /* ignore */ }
          }
          window.addEventListener('storage', onStorage)
          return () => { window.removeEventListener('storage', onStorage) }
        }, 'fanren-theme: cross-window settings sync')
      },
    }
  },
})
