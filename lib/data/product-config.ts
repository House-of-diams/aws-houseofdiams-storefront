import type { Product } from '@/lib/data/products';

export const METAL_META: Record<string, { name: string; color: string }> = {
  '18k-yellow': { name: '18K Yellow', color: '#E7C275' },
  '18k-white': { name: '18K White', color: '#E5E4E2' },
  '18k-rose': { name: '18K Rose', color: '#E4B3A3' },
  '10k-yellow-gold': { name: '10K Yellow Gold', color: '#E7C275' },
  '10k-white-gold': { name: '10K White Gold', color: '#E5E4E2' },
  '10k-rose-gold': { name: '10K Rose Gold', color: '#E4B3A3' },
  '14k-yellow-gold': { name: '14K Yellow Gold', color: '#E7C275' },
  '14k-white-gold': { name: '14K White Gold', color: '#E5E4E2' },
  '14k-rose-gold': { name: '14K Rose Gold', color: '#E4B3A3' },
  '18k-yellow-gold': { name: '18K Yellow Gold', color: '#E7C275' },
  '18k-white-gold': { name: '18K White Gold', color: '#E5E4E2' },
  '18k-rose-gold': { name: '18K Rose Gold', color: '#E4B3A3' },
  '14k': { name: '14K Gold', color: '#D4AF37' },
  'platinum': { name: 'Platinum', color: '#CFCFCF' },
  '925-silver': { name: '925 Silver', color: '#C0C0C0' },
  'silver': { name: '925 Silver', color: '#C0C0C0' },
};

export function metalCaratFromKey(metal: string) {
  if (!metal) return '18K';
  if (metal.startsWith('18k')) return '18K';
  if (metal === '14k') return '14K';
  if (metal === '10k') return '10K';
  if (metal === '22k') return '22K';
  if (metal === 'platinum') return 'Pt 950';
  if (metal.includes('silver')) return '925 Sterling';
  return '18K';
}

export const SIZE_MAP: Record<string, { name: string; opts: string[] }> = {
  ring: { name: 'Ring Size (US)', opts: ['US 5', 'US 6', 'US 7', 'US 8', 'US 9', 'US 10', 'Other'] },
  bracelet: { name: 'Length', opts: ['6.5"', '7"', '7.5"', '8"', '8.5"', 'Custom'] },
  necklace: { name: 'Chain Length', opts: ['16"', '18"', '20"', '22"', '24"'] },
  pendant: { name: 'Chain Length', opts: ['16"', '18"', '20"', '22"', 'No chain'] },
  chain: { name: 'Length', opts: ['18"', '20"', '22"', '24"', '26"', '30"'] },
  earring: { name: 'Fit', opts: ['Standard', 'Lever-back', 'Stud Only'] },
  grillz: { name: 'Teeth', opts: ['2 Top', '4 Top', '6 Top', '6 Bottom', 'Full Set'] },
};

export const CUT_MAP: Record<string, string> = {
  round: 'Round Brilliant',
  oval: 'Oval',
  pear: 'Pear',
  cushion: 'Cushion',
  'emerald-cut': 'Emerald Cut',
  princess: 'Princess',
  baguette: 'Baguette',
};

export const STONE_MAP: Record<string, string> = {
  'cvd-colourless': 'Lab-Grown Diamond',
  'natural-colourless': 'Natural',
  'natural-fancy': 'Natural Fancy',
};

export const DIAMOND_SPEC_KEYS = [
  'Centre Stone',
  'Centre Diamond',
  'Side Stones',
  'Stones',
  'Total Stones',
  'Colour Grade',
  'Color Grade',
  'Clarity',
  'Cut Grade',
  'Total Carat',
  'Total Carat Weight',
  'Certificate',
];

const typeLabel = (kind: string) => {
  const map: Record<string, string> = {
    ring: 'ring',
    pendant: 'pendant',
    bracelet: 'bracelet',
    necklace: 'necklace',
    earring: 'earrings',
    chain: 'chain',
    grillz: 'grillz',
  };
  return map[kind] ?? 'jewelry piece';
};

const formatMetal = (metals: string[]) => METAL_META[metals[0]]?.name ?? metals[0] ?? '18K Gold';

export function getProductDescription(product: Product) {
  const cut = CUT_MAP[product.cut] ?? 'Round Brilliant';
  const stone = STONE_MAP[product.stone] ?? 'Diamond';
  const metal = formatMetal(product.metals);

  return `${product.name} is crafted as a premium ${typeLabel(product.type)} in ${metal}, set with ${product.carat} ${cut} ${stone} diamonds. Designed for high light return, secure everyday wear, and made-to-order finishing from our Surat atelier.`;
}

export function getProductSpecs(product: Product): Record<string, string> {
  const cut = CUT_MAP[product.cut] ?? product.cut;
  const stone = STONE_MAP[product.stone] ?? product.stone;

  return {
    'Centre Stone': `${product.carat} ${cut}`,
    'Diamond Type': stone,
    'Metal': formatMetal(product.metals),
    'Cut Grade': 'Excellent',
    'Clarity': product.category === 'fine' ? 'VS1-VS2' : 'VS-SI',
    'Certificate': product.category === 'fine' ? 'IGI / GIA' : 'IGI',
    'Crafted In': 'Surat, India',
    'Finish': 'High Polish',
  };
}
