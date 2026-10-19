import localFont from 'next/font/local'

export const cinzelFont = localFont({
  src: '../public/fonts/Cinzel-VariableFont_wght.ttf',
  variable: '--font-cinzel',
  preload: false, // used below the fold; keeps the Link header small (HOD-074)
  display: 'swap',
  weight: '100 900',
  style: 'normal',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: false,
})

export const interFont = localFont({
  src: '../public/fonts/Inter-VariableFont_opsz,wght.ttf',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
  fallback: ['Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
})

export const montserratFont = localFont({
  src: '../public/fonts/Montserrat-VariableFont_wght.ttf',
  variable: '--font-montserrat',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
  fallback: ['Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
})

export const marcellusFont = localFont({
  src: '../public/fonts/Marcellus-Regular.ttf',
  variable: '--font-marcellus',
  preload: false, // used below the fold; keeps the Link header small (HOD-074)
  display: 'swap',
  weight: '400',
  style: 'normal',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: false,
})

export const houseOfDiamsWordmarkFont = localFont({
  src: '../public/fonts/Aureva-BF69b26e583d8bb.otf',
  variable: '--font-house-of-diams-wordmark',
  display: 'swap',
})

export const loaderWordmarkFont = localFont({
  src: '../public/fonts/Roman Cavalry.otf',
  variable: '--font-loader-wordmark',
  display: 'swap',
})

export const aurestiaFont = localFont({
  src: '../public/fonts/Aurestia-ThinCondensed.otf',
  variable: '--font-aurestia',
  preload: false, // used below the fold; keeps the Link header small (HOD-074)
  display: 'swap',
})

export const venezaFont = localFont({
  src: '../public/fonts/VenezaDEMO-Regular-BF69e59021eb98c.ttf',
  variable: '--font-veneza',
  preload: false, // used below the fold; keeps the Link header small (HOD-074)
  display: 'swap',
})
