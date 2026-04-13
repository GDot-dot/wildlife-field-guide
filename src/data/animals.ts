export interface Animal {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  imageUrl: string;
  habitat: string;
  rarity: 'Common' | 'Uncommon' | 'Rare';
}

export const animals: Animal[] = [
  {
    id: 'sparrow',
    name: '麻雀',
    scientificName: 'Passer montanus',
    description: '最常見的都市鳥類，喜歡群聚，適應力極強。',
    imageUrl: 'https://images.unsplash.com/photo-1535083252446-faea5c0f651f?auto=format&fit=crop&q=80&w=800',
    habitat: '都市、農田',
    rarity: 'Common'
  },
  {
    id: 'japanese-white-eye',
    name: '綠繡眼',
    scientificName: 'Zosterops japonicus',
    description: '體型小巧，背部黃綠色，眼周有一圈明顯的白色羽毛。常在樹枝間跳躍覓食。',
    imageUrl: 'https://images.unsplash.com/photo-1552727451-6fde190ee64e?auto=format&fit=crop&q=80&w=800',
    habitat: '公園、庭院、次生林',
    rarity: 'Common'
  },
  {
    id: 'light-vented-bulbul',
    name: '白頭翁',
    scientificName: 'Pycnonotus sinensis',
    description: '頭頂有白斑，叫聲清脆響亮，是都市三寶之一。',
    imageUrl: 'https://images.unsplash.com/photo-1615266895738-11f1371cd7e5?auto=format&fit=crop&q=80&w=800',
    habitat: '都市、公園、林緣',
    rarity: 'Common'
  },
  {
    id: 'taiwan-blue-magpie',
    name: '台灣藍鵲',
    scientificName: 'Urocissa caerulea',
    description: '台灣特有種，擁有華麗的藍色羽毛和長尾巴，性情兇悍，有群聚護巢行為。',
    imageUrl: 'https://images.unsplash.com/photo-1590130651165-271b2e1e0757?auto=format&fit=crop&q=80&w=800',
    habitat: '低海拔闊葉林',
    rarity: 'Rare'
  },
  {
    id: 'black-crowned-night-heron',
    name: '夜鷺',
    scientificName: 'Nycticorax nycticorax',
    description: '常在水邊靜止不動等待獵物，俗稱「暗光鳥」。',
    imageUrl: 'https://images.unsplash.com/photo-1604514628550-37477afdf4e3?auto=format&fit=crop&q=80&w=800',
    habitat: '溪流、湖泊、溼地',
    rarity: 'Uncommon'
  },
  {
    id: 'crested-serpent-eagle',
    name: '大冠鷲',
    scientificName: 'Spilornis cheela',
    description: '常見的猛禽，飛行時常發出「忽、忽、悠伊」的鳴叫聲。',
    imageUrl: 'https://images.unsplash.com/photo-1611084374526-92f70b021d74?auto=format&fit=crop&q=80&w=800',
    habitat: '中低海拔山區',
    rarity: 'Uncommon'
  }
];
