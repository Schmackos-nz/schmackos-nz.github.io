// ============================================================
// Sprites: tiny pixel-art engine. Every sprite in the game is
// defined as a grid of characters and rendered to a canvas.
// '.' = transparent, everything else looks up the palette.
// ============================================================
const Sprites = (() => {

  const DEFS = {
    // ---------------- heroes ----------------
    knight: { p: { K:'#10151a', S:'#b8c6d0', D:'#5d707d', R:'#c23b2e', F:'#e8b07a', E:'#1c2024', G:'#7d6a3a' }, g: [
      '......RRR.......',
      '.....RRRRR......',
      '....KKKKKKK.....',
      '....KSSSSSK.....',
      '....KDDDDDK.....',
      '...KSFFFFFSK....',
      '...KSFEFFEFK....',
      '...KSFFFFFSK....',
      '....KSSSSSK.....',
      '..KKSSDSDSSKK...',
      '.KSSK SSSS KSSK.',
      '.KSDK SSSS KDSK.',
      '.KGGK DSSD KGGK.',
      '....KDDDDDK.....',
      '....KDD.DDK.....',
      '....KDD.DDK.....',
      '...KKKK.KKKK....',
    ]},
    huntress: { p: { K:'#0e1410', G:'#2f8f4e', D:'#1d5c32', F:'#e8b07a', E:'#142018', B:'#7a5230', W:'#caa46a' }, g: [
      '....KKKKKK......',
      '...KGGGGGGK.....',
      '..KGGGGGGGGK....',
      '..KGDFFFFDGK....',
      '..KGDFEFEFGK..W.',
      '..KGDFFFFDGK..W.',
      '...KGDFFDGK...W.',
      '....KGGGGK...WW.',
      '..KKGGDGGGKK.W..',
      '.KGGK GGGG KWW..',
      '.KGDK GDDG KW...',
      '.KBBK GGGG WW...',
      '....KDDDDK.W....',
      '....KDD.DK......',
      '....KBB.BBK.....',
      '...KKK..KKK.....',
    ]},
    arcanist: { p: { K:'#0e1020', B:'#3a6ea8', D:'#22456e', F:'#e8b07a', E:'#101828', S:'#b08948', M:'#7fd4ff' }, g: [
      '.......M........',
      '......MMM.......',
      '....KKKKKKK..S..',
      '...KBBBBBBBK.S..',
      '...KBDDDDDBK.S..',
      '...KDFFFFFDK.S..',
      '...KDFEFEFDKMSM.',
      '...KDFFFFFDK.S..',
      '....KBBBBBK..S..',
      '..KKBBDBDBBKKS..',
      '.KBBK BBBB KSS..',
      '.KBDK BDDB KS...',
      '.KBBK BBBB KS...',
      '...KDDDDDDDK....',
      '...KDDDDDDDK....',
      '..KKKKKKKKKKK...',
    ]},
    // ---------------- enemies ----------------
    gloop: { p: { K:'#0c1a0e', G:'#4fae46', L:'#7fd46e', D:'#2e7a2a', E:'#0c1a0e', W:'#d8f5c8' }, g: [
      '................',
      '................',
      '......KKKK......',
      '....KKGLLGKK....',
      '...KGLLLLLLGK...',
      '..KGLLWLLWLLGK..',
      '..KGLLELLELLGK..',
      '.KGLLLLLLLLLLGK.',
      '.KGLLLKKKKLLLGK.',
      '.KGGLLLLLLLLGGK.',
      'KGGGLLLLLLLLGGGK',
      'KGDGGGGGGGGGGDGK',
      'KDDGGGGGGGGGGDDK',
      '.KDDDDDDDDDDDDK.',
      '..KKDDDDDDDDKK..',
      '....KKKKKKKK....',
    ]},
    rat: { p: { K:'#150f0a', B:'#8a6242', D:'#5c3f28', P:'#d88a8a', E:'#e03030', W:'#e8e0d0' }, g: [
      '................',
      '................',
      '................',
      '..KK........KK..',
      '.KPPK......KPPK.',
      '.KPBKKKKKKKKBPK.',
      '..KBBBBBBBBBBK..',
      '.KBBEBBBBBBEBBK.',
      '.KBBBBBBBBBBBBK.',
      'KBBDBBBBBBBBDBBK',
      'KBBBBBBWWBBBBBBK',
      'KDBBBBBWWBBBBBDK',
      '.KDDBBBBBBBBDDK.',
      '..KKDDDDDDDDKK..',
      '..K.KK.KK.KK.K..',
      '.PPP.........PPP',
    ]},
    zealot: { p: { K:'#16101e', P:'#6b3fa0', D:'#46286b', F:'#cfa6e8', E:'#ffd24d', G:'#2e1c44' }, g: [
      '......KKKK......',
      '.....KPPPPK.....',
      '....KPPPPPPK....',
      '...KPPDDDDPPK...',
      '...KPDGGGGDPK...',
      '...KPDGEEGDPK...',
      '...KPDGGGGDPK...',
      '....KPDDDDPK....',
      '..KKPPPPPPPPKK..',
      '.KPPK PPPP KPPK.',
      '.KPDK PDDP KDPK.',
      '.KFFK PPPP KFFK.',
      '....KPPPPPPK....',
      '....KPDDDDPK....',
      '...KPPPPPPPPK...',
      '..KKKKKKKKKKKK..',
    ]},
    crawler: { p: { K:'#140e08', B:'#9a6a2e', D:'#6b4a1e', S:'#d8c050', E:'#30c050', T:'#e8e8d8' }, g: [
      '..T....TT....T..',
      '..KT..TKKT..TK..',
      '...KT.KBBK.TK...',
      '..T.KKBBBBKK.T..',
      '..KTKBBSSBBKTK..',
      '...KBBSBBSBBK...',
      '..KBBSBBBBSBBK..',
      '.KBBBBEBBEBBBBK.',
      '.KBBBBBBBBBBBBK.',
      '.KDBBBKBBKBBBDK.',
      '.KDBBBKBBKBBBDK.',
      '..KDDBBBBBBDDK..',
      '...KKDDDDDDKK...',
      '..KK.KKKKKK.KK..',
      '.K..K......K..K.',
      'K..............K',
    ]},
    shroom: { p: { K:'#1a0c0c', R:'#c8463c', D:'#8a2c26', W:'#e8ddc8', S:'#cbb89a', E:'#3a2418' }, g: [
      '.....KKKKKK.....',
      '...KKRRRRRRKK...',
      '..KRRWRRRRWRRK..',
      '.KRRRRRRWRRRRRK.',
      '.KRWRRRRRRRRWRK.',
      'KRRRRRWRRRRRRRRK',
      'KRDRRRRRRRWRRDRK',
      'KDDDDDDDDDDDDDDK',
      '.KKSSSSSSSSSSKK.',
      '...KSESSSSESK..',
      '...KSSSSSSSSK...',
      '...KSSKKKKSSK...',
      '...KSSSSSSSSK...',
      '....KSSSSSSK....',
      '....KSSKKSSK....',
      '...KKKK..KKKK...',
    ]},
    bandit: { p: { K:'#12100e', G:'#5a5a66', D:'#3a3a44', F:'#d8a06a', E:'#e8e8e8', B:'#2a2026', S:'#aab4be' }, g: [
      '....KKKKKKK.....',
      '...KGGGGGGGK....',
      '...KGDDDDDGK....',
      '...KBBBBBBBK....',
      '...KBFEFEFBK....',
      '...KBBBBBBBK....',
      '....KFFFFFK.....',
      '..KKGGGGGGGKK...',
      '.KGGK GGGG KGGK.',
      '.KGDK GDDG KDGK.',
      '.KFFK GGGG KFFK.',
      '..SS..GGGG......',
      '..S..KDDDDK.....',
      '..S..KDD.DK.....',
      '.....KBB.BBK....',
      '....KKK..KKK....',
    ]},
    golem: { p: { K:'#0e0e12', S:'#7a8088', D:'#4e545c', L:'#9aa2ac', E:'#ffb030', M:'#3a6e3a' }, g: [
      '...KKKKKKKKKK...',
      '..KSSSLLLLSSSK..',
      '..KSDDDDDDDDSK..',
      '..KSDEDDDDEDSK..',
      '..KSDDDDDDDDSK..',
      '..KSSSDDDDSSSK..',
      'KKKSSSSSSSSSSKKK',
      'KSSKSSLLLLSSKSSK',
      'KSDKSSSSSSSSKDSK',
      'KSSKSMSSSSMSKSSK',
      'KDDKSSSSSSSSKDDK',
      'KSSKSSDSSDSSKSSK',
      '.KKKSSDSSDSSKKK.',
      '...KSSKSSKSSK...',
      '...KDDK..KDDK...',
      '..KKKKK..KKKKK..',
    ]},
    champion: { p: { K:'#101014', B:'#d8d4c4', D:'#a09a86', E:'#cc3333', S:'#5d707d', G:'#7d6a3a' }, g: [
      '....KKKKKKK.....',
      '...KBBBBBBBK....',
      '...KBDDDDDBK....',
      '...KBEBDEBBK....',
      '...KBBBBBBBK....',
      '....KBKKKBK.....',
      '....KBBBBBK.....',
      '..KKBBBBBBBKK...',
      '.KBBKSSSSSKBBK..',
      '.KBDKSGGSSKDBK..',
      '.KBBKSSSSSKBBK..',
      'SSS..KSSSK..BBB.',
      'S.S..KBBBK..B.B.',
      'S.S.KBB.BBK.B.B.',
      'SSS.KBB.BBK.BBB.',
      '...KKKK.KKKK....',
    ]},
    gravelord: { p: { K:'#0a0a10', P:'#3c2a52', D:'#241636', B:'#d8d4c4', E:'#66e0ff', G:'#c8a040', M:'#1a1026' }, g: [
      '..G..G.GG.G..G..',
      '..GG.G.GG.G.GG..',
      '..KGGGGGGGGGGK..',
      '..KPPPPPPPPPPK..',
      '.KPDDDDDDDDDDPK.',
      '.KPDBBBBBBBBDPK.',
      '.KPDBEBBBBEBDPK.',
      '.KPDBBBBBBBBDPK.',
      '.KPDDBKKKKBDDPK.',
      '.KPPDDDDDDDDPPK.',
      'KPPKPPPPPPPPKPPK',
      'KPDKPDDPPDDPKDPK',
      'KBBKPPPPPPPPKBBK',
      'KBBKPPDDDDPPKBBK',
      '.KKPPPPPPPPPPKK.',
      '.KPPPDDDDDDPPPK.',
      '.KPPPPPPPPPPPPK.',
      '.KMMMMMMMMMMMMK.',
      '..KKKKKKKKKKKK..',
    ]},
    // ---------------- scenery ----------------
    campfire: { p: { K:'#140c06', W:'#6b4a26', Y:'#ffd24d', O:'#ff8c2e', R:'#d8482e' }, g: [
      '.......Y........',
      '......YY........',
      '......YYY..Y....',
      '.....YOOY.YY....',
      '.....YOOYY......',
      '....YOORROY.....',
      '....YORRROOY....',
      '...YORRRRROY....',
      '...YORRRRRROY...',
      '..YOORRRRRROY...',
      '..KWWKWWWWKWK...',
      '.KWWWWKWWWWWWK..',
      'KWWWWWWWWWWWWWK.',
      '.KKKKKKKKKKKKK..',
    ]},
    chest: { p: { K:'#140c06', W:'#8a5c2e', D:'#5c3a1c', G:'#e6b95c', Y:'#ffe9b0' }, g: [
      '..KKKKKKKKKKKK..',
      '.KWWWWWWWWWWWWK.',
      'KWGGWWWWWWWWGGWK',
      'KWWWWWWWWWWWWWWK',
      'KGGGGGGGGGGGGGGK',
      'KWWWWWGYYGWWWWWK',
      'KWWWWWGYYGWWWWWK',
      'KDDDDDGGGGDDDDDK',
      'KWWWWWWWWWWWWWWK',
      'KWGGWWWWWWWWGGWK',
      'KDWWWDDDDDDWWWDK',
      '.KKKKKKKKKKKKKK.',
    ]},
  };

  // ---------------- 9x9 icons (cards, map, intents, relics) ----------------
  const ICONS = {
    sword:  { p:{S:'#cdd6de',D:'#7d8a96',G:'#b08948',K:'#1a1a22'}, g:[
      '........S','.......SS','......SS.','.....SS..','K...SS...','.K.SS....','..GS.....','.GG......','GG.K.....']},
    shield: { p:{B:'#5b8db8',L:'#9cc3e0',D:'#2e5a80',G:'#e6b95c'}, g:[
      'BBBBBBBBB','BLLLBLLLB','BLLGGGLLB','BLLLGLLLB','BDLLGLLDB','.BDLGLDB.','.BDDGDDB.','..BDDDB..','...BBB...']},
    fan:    { p:{S:'#cdd6de',G:'#b08948'}, g:[
      'S...S...S','S...S...S','.S..S..S.','.S..S..S.','..S.S.S..','..S.S.S..','...SSS...','...GGG...','....G....']},
    poison: { p:{G:'#4fae46',L:'#9be09b',D:'#2e7a2a'}, g:[
      '....G....','...GG....','...GGG...','..GLGGG..','..GGGGG..','.GGLGGGG.','.GGGGGGD.','..GGGGD..','...DDD...']},
    bolt:   { p:{Y:'#ffd24d',O:'#ff9a2e'}, g:[
      '....YYYY.','...YYY...','..YYY....','.YYYYYYY.','....YYY..','...YYY...','..YYO....','.YYO.....','.YO......']},
    fire:   { p:{Y:'#ffd24d',O:'#ff8c2e',R:'#d8482e'}, g:[
      '....Y....','...YY..Y.','..YOY.YY.','..YOOYY..','.YOORROY.','.YORRROY.','.YORRROY.','..YOOOY..','...YYY...']},
    star:   { p:{Y:'#ffe9b0',G:'#e6b95c'}, g:[
      '....Y....','....Y....','...YYY...','YYYYGYYYY','...YGY...','...YGY...','..YY.YY..','..Y...Y..','.........']},
    draw:   { p:{W:'#e8e2d0',B:'#5b8db8',D:'#3a3a50'}, g:[
      '.WWWWW...','.WDDDW...','.WWWWWWW.','.WWWBBBW.','.WWWBDBW.','..WWBBBW.','...WBBBW.','...WWWWW.','.........']},
    buff:   { p:{G:'#6dbb6d',L:'#9be09b'}, g:[
      '....L....','...LGL...','..LGGGL..','.LGGGGGL.','...GGG...','...GGG...','...GGG...','...GGG...','.........']},
    heart:  { p:{R:'#e25c5c',D:'#a82e2e',W:'#ffd0d0'}, g:[
      '.RR...RR.','RWRR.RRRR','RRRRRRRRR','RRRRRRRRR','.RRRRRRR.','..RRRRR..','...RRR...','....R....','.........']},
    coin:   { p:{G:'#e6b95c',Y:'#ffe9b0',D:'#8a6420'}, g:[
      '..GGGGG..','.GYYYGGG.','GYYGGGGGG','GYGGDDGGG','GYGGDGGGG','GGGGDDGGG','GGGGDGGGG','.GGGGGGG.','..GGGGG..']},
    skull:  { p:{W:'#e8e4d8',D:'#a8a294',K:'#1a1a22'}, g:[
      '..WWWWW..','.WWWWWWW.','.WWWWWWW.','.WKKWKKW.','.WKKWKKW.','.WWWWWWW.','..WWKWW..','..WDWDW..','..W.W.W..']},
    rest:   { p:{Y:'#ffd24d',O:'#ff8c2e',W:'#6b4a26'}, g:[
      '....Y....','...YY.Y..','...YOYY..','..YOOY...','..YOOOOY.','.YOOOOOY.','.YOOOOOY.','.WWWWWWW.','W...W...W']},
    shop:   { p:{G:'#e6b95c',W:'#e8e2d0',D:'#8a6420'}, g:[
      '...WWW...','..W...W..','..W...W..','.GGGGGGG.','.GDGGGDG.','.GGGGGGG.','.GGDDDGG.','.GGGGGGG.','..GGGGG..']},
    mystery:{ p:{P:'#b48ae0',D:'#6b3fa0'}, g:[
      '..PPPPP..','.PP...PP.','.....PP..','....PP...','...PP....','...PP....','.........','...PP....','...PP....']},
  };

  function render(def, scale) {
    const rows = def.g, pal = def.p;
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const cv = document.createElement('canvas');
    cv.width = w * scale; cv.height = h * scale;
    const ctx = cv.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = pal[ch] || '#ff00ff';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return cv;
  }

  const cache = {};
  function get(name, scale = 6) {
    const key = name + '@' + scale;
    if (!cache[key]) {
      const def = DEFS[name] || ICONS[name];
      if (!def) throw new Error('No sprite: ' + name);
      cache[key] = render(def, scale);
    }
    // return a fresh copy so it can live in multiple DOM spots
    const src = cache[key];
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    return cv;
  }

  function icon(name, scale = 3) { return get(name, scale); }

  return { get, icon, DEFS, ICONS };
})();
