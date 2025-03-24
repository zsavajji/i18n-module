import VueMeta from 'vue-meta'
import { Constants, options } from './options'
import { formatMessage } from './utils-common'

/**
 * @this {import('vue/types/vue').Vue}
 * @param {import('../../types/vue').NuxtI18nHeadOptions} options
 * @return {import('vue-meta').MetaInfo}
 */
export function nuxtI18nHead ({ addDirAttribute = false, addSeoAttributes = false } = {}) {
  // Can happen when using from a global mixin.
  if (!this.$i18n) {
    return {}
  }

  /** @type {import('../../types/vue').NuxtI18nMeta} */
  const metaObject = {
    htmlAttrs: {},
    link: [],
    meta: []
  }

  const currentLocale = this.$i18n.localeProperties
  const currentLocaleIso = currentLocale.iso
  const currentLocaleDir = currentLocale.dir || options.defaultDirection

  /**
   * Adding Direction Attribute:
   */
  if (addDirAttribute) {
    metaObject.htmlAttrs.dir = currentLocaleDir
  }

  /**
   * Adding SEO Meta:
   */
  if (
    addSeoAttributes &&
    // @ts-ignore
    (VueMeta.hasMetaInfo ? VueMeta.hasMetaInfo(this) : this._hasMetaInfo) &&
    this.$i18n.locale &&
    this.$i18n.locales
  ) {
    if (currentLocaleIso) {
      metaObject.htmlAttrs.lang = currentLocaleIso // TODO: simple lang or "specific" lang with territory?
    }

    const locales = /** @type {import('../../types').LocaleObject[]} */(this.$i18n.locales)

    addCanonicalLinks.bind(this)(this.$i18n.__baseUrl, metaObject.link, locales, addSeoAttributes)
    addCurrentOgLocale.bind(this)(currentLocale, currentLocaleIso, metaObject.meta)
    addAlternateOgLocales.bind(this)(locales, currentLocaleIso, metaObject.meta)
  }

  /**
   * Internals:
   */

  /**
   * @this {import('vue/types/vue').Vue}
   *
   * @param {import('../../types').LocaleObject[]} locales
   * @param {string} baseUrl
   * @param {import('../../types/vue').NuxtI18nMeta['link']} link
   */
  function addHreflangLinks (locales, baseUrl, link) {
    if (options.strategy === Constants.STRATEGIES.NO_PREFIX) {
      return
    }
    /** @type {Map<string, import('../../types').LocaleObject>} */
    const localeMap = new Map()
    for (const locale of locales) {
      const { iso: localeIso, disableHref } = locale
      if (disableHref) { continue }

      if (!localeIso) {
        console.warn(formatMessage('Locale ISO code is required to generate alternate link'))
        continue
      }

      localeMap.set(localeIso, locale)
    }
    for (const [iso, mapLocale] of localeMap.entries()) {
      const localePath = this.switchLocalePath(mapLocale.code)
      const _resolvable = (this.$route?.params && !Object.keys(this.$route?.params).length) ||
        (options.vuex && (this.$i18n.locale === mapLocale.code || !!this.$store?.state.i18n?.routeParams[mapLocale.code]))

      if (_resolvable && localePath) {
        if (mapLocale.countries) {
          mapLocale.countries.forEach(country => {
            link.push({
              hid: `i18n-alt-${country}`,
              rel: 'alternate',
              href: toAbsoluteUrl(localePath, baseUrl),
              hreflang: country
            })
          })
        } else {
          link.push({
            hid: `i18n-alt-${iso}`,
            rel: 'alternate',
            href: toAbsoluteUrl(localePath, baseUrl),
            hreflang: iso
          })
        }
      }
    }

    if (options.defaultLocale || options.xDefault) {
      let localePath
      if (options.xDefault) {
        localePath = this.switchLocalePath(options.xDefault)
      } else {
        localePath = this.switchLocalePath(options.defaultLocale)
      }

      if (localePath) {
        link.push({
          hid: 'i18n-xd',
          rel: 'alternate',
          href: toAbsoluteUrl(localePath, baseUrl),
          hreflang: 'x-default'
        })
      }
    }
  }

  /**
   * @this {import('vue/types/vue').Vue}
   *
   * @param {string} baseUrl
   * @param {import('../../types/vue').NuxtI18nMeta['link']} link
   * @param {import('../../types').LocaleObject[]} locales
   * @param {NonNullable<import('../../types/vue').NuxtI18nHeadOptions['addSeoAttributes']>} seoAttributesOptions
   */
  function addCanonicalLinks (baseUrl, link, locales, seoAttributesOptions) {
    const currentRoute = this.localeRoute({
      ...this.$route,
      name: this.getRouteBaseName()
    })

    if (currentRoute) {
      let href = toAbsoluteUrl(currentRoute.path, baseUrl)

      const canonicalQueries = (typeof (seoAttributesOptions) !== 'boolean' && seoAttributesOptions.canonicalQueries) || []

      if (canonicalQueries.length) {
        const currentRouteQueryParams = currentRoute.query
        const params = new URLSearchParams()
        for (const queryParamName of canonicalQueries) {
          if (queryParamName in currentRouteQueryParams) {
            const queryParamValue = currentRouteQueryParams[queryParamName]

            if (Array.isArray(queryParamValue)) {
              queryParamValue.forEach(v => params.append(queryParamName, v || ''))
            } else {
              params.append(queryParamName, queryParamValue || '')
            }
          }
        }

        const queryString = params.toString()

        if (queryString) {
          href = `${href}?${queryString}`
        }
      }

      if (href === toAbsoluteUrl(currentRoute.fullPath, baseUrl)) {
        addHreflangLinks.bind(this)(locales, baseUrl, link)
      }

      link.push({
        hid: 'i18n-can',
        rel: 'canonical',
        href
      })
    }
  }

  /**
   * @this {import('vue/types/vue').Vue}
   *
   * @param {import('../../types').LocaleObject} currentLocale
   * @param {string | undefined} currentLocaleIso
   * @param {import('../../types/vue').NuxtI18nMeta['meta']} meta
   */
  function addCurrentOgLocale (currentLocale, currentLocaleIso, meta) {
    const hasCurrentLocaleAndIso = currentLocale && currentLocaleIso

    if (!hasCurrentLocaleAndIso) {
      return
    }

    meta.push({
      hid: 'i18n-og',
      property: 'og:locale',
      // Replace dash with underscore as defined in spec: language_TERRITORY
      content: hypenToUnderscore(currentLocaleIso)
    })
  }

  /**
   * @this {import('vue/types/vue').Vue}
   *
   * @param {import('../../types').LocaleObject[]} locales
   * @param {string | undefined} currentLocaleIso
   * @param {import('../../types/vue').NuxtI18nMeta['meta']} meta
   */
  function addAlternateOgLocales (locales, currentLocaleIso, meta) {
    const localesWithoutCurrent = locales.filter(locale => {
      const localeIso = locale.iso
      return localeIso && localeIso !== currentLocaleIso
    })

    if (localesWithoutCurrent.length) {
      const alternateLocales = localesWithoutCurrent.map(locale => ({
        hid: `i18n-og-alt-${locale.iso}`,
        property: 'og:locale:alternate',
        content: hypenToUnderscore(locale.iso)
      }))

      meta.push(...alternateLocales)
    }
  }

  /**
   * @param {string | undefined} str
   * @return {string}
   */
  function hypenToUnderscore (str) {
    return (str || '').replace(/-/g, '_')
  }

  /**
   * @param {string} urlOrPath
   * @param {string} baseUrl
   */
  function toAbsoluteUrl (urlOrPath, baseUrl) {
    if (urlOrPath.match(/^https?:\/\//)) {
      return urlOrPath
    }
    return baseUrl + urlOrPath
  }

  return metaObject
}
