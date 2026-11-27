// /faq/ よくある質問（2026-11-21、2026-11-25 言い換えの辞書と0件の画面を足した）
// 1) 「言葉でさがす」：入れた言葉を含む質問だけを出す（カタカナ・ひらがな、全角・半角の違いは気にしない）。
//    見つかった数が5件以下なら開いて答えまで見せる。
//    ・空白や「、」で区切った言葉は、全部を含む質問を出す（例：「駐車場 無料」）。
//    ・お客さんの言葉を、サイトの言葉に言い換えて探す（例：お風呂→シャワー・温泉、ひらがなの読み→漢字）。
//    ・0件なら「『〇〇』に合う質問は、まだありません」と、近い言葉のボタン・ほかのページ・電話とフォームを出す。
//    ・変換の途中（ひらがなを打っている間）は「見つかりません」を出さない。
//    ・0件になった言葉は、GTM の dataLayer に faq_search_zero で入れるだけ（ほかへは送らない）。
// 2) /faq/#faq-cancel のように質問のidで来たら、その質問を開く（トップ・問い合わせページの「ベスト5」から）
// 3) 「分類から探す」のボタンは、検索中に押したら検索を消してその分類へ（0件のあいだも動く）
(function () {
  'use strict';

  var root = document.getElementById('faq');
  if (!root) { return; }
  var items = Array.prototype.slice.call(root.querySelectorAll('details.faq'));
  var sections = Array.prototype.slice.call(root.querySelectorAll('section'));

  function norm(t) {
    var s = String(t || '');
    if (s.normalize) { s = s.normalize('NFKC'); }
    s = s.toLowerCase().replace(/\s+/g, '');
    // カタカナ → ひらがな
    return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  var texts = items.map(function (d) { return norm(d.textContent); });

  // ---- 言い換えの辞書 ----------------------------------------------------
  // [お客さんの言葉, サイトの言葉]。左の言葉そのものを入れたとき、右の言葉を含む質問も出す。
  // 右には、このページの質問・答えに実際にある言葉だけを書く（無い事実を作らない）。
  var SYNONYMS = [
    // お風呂・トイレ
    [['お風呂', 'おふろ', '風呂', 'ふろ', '湯船', 'ゆぶね', '浴槽', '入浴', '大浴場', '銭湯', 'せんとう', 'バスタブ', '露天風呂', 'スパ'], ['シャワー', '温泉', 'お風呂']],
    [['おんせん', '日帰り温泉'], ['温泉']],
    [['トイレ', 'お手洗い', 'おてあらい', '便所', 'ウォシュレット', 'ウオシュレット'], ['トイレ', 'ウォシュレット']],
    [['サウナ', 'ととのう', '整う', 'ロウリュ', '水風呂'], ['サウナ']],
    // お金
    [['値段', 'ねだん', '費用', 'ひよう', '予算', 'よさん', '総額', 'お金', 'おかね', '金額', '価格', 'かかく', '代金', 'りょうきん', '料金表', '宿泊費', '宿泊料金'], ['料金']],
    [['カード', 'クレジット', 'クレジットカード', 'クレカ', 'paypay', 'ペイペイ', '電子マネー', '前払い', '後払い', '振り込み', 'ふりこみ', 'しはらい', '払い方', '決済'], ['支払', '振込']],
    [['請求書', 'せいきゅうしょ', 'インボイス', '領収書', 'りょうしゅうしょ', '領収証', '宛名', '見積', 'みつもり', '見積書', 'お見積'], ['請求書', '領収書', '見積']],
    [['割引', 'わりびき', '安く', 'やすく', '連泊', 'リピート', '地域割', 'お得', 'おとく'], ['割引']],
    [['げんきん'], ['現金']],
    [['キャンセル', 'キャンセル料', '取り消し', 'とりけし', '取消', '解約'], ['キャンセル']],
    [['人数変更', 'にんずうへんこう', '人数が増え', '人数が減', '増える', '減る', '増員', '減員'], ['人数が変わ', '人数・食事の変更']],
    [['繁忙期', 'はんぼうき', 'なつやすみ', 'はるやすみ', '年末年始', 'ねんまつねんし', 'お盆', 'おぼん', 'gw', 'ゴールデンウィーク', 'ゴールデンウイーク', '連休', 'れんきゅう', '正月', 'お正月', 'しょうがつ', '金曜', 'きんよう', '金曜日', '祝前日', '週末', 'しゅうまつ', '休日', 'きゅうじつ', '祝日', 'しゅくじつ', '土日', 'どにち', '平日', 'へいじつ'], ['ハイシーズン', '土日祝', '平日']],
    // 人数・人
    [['何名', 'なんめい', '何名から', 'なんにん', '最低人数', 'さいていにんずう', '最少人数', '少人数', 'しょうにんずう', '定員', 'ていいん', '何人まで', '最大人数', '大人数', '団体'], ['何人', '人から']],
    [['にんずう'], ['人数']],
    [['子ども', '子供', 'こども', '子連れ', 'こづれ', '幼児', 'ようじ', 'キッズ', '未就学', '園児'], ['子ども', 'お子さま', 'お子様', '小学生', '3〜5歳']],
    [['赤ちゃん', 'あかちゃん', '赤ん坊', '乳児', '乳幼児', 'ベビー', '0歳', '1歳', '2歳', '添い寝', 'そいね'], ['赤ちゃん', '2歳以下', '添い寝']],
    [['しょうがくせい'], ['小学生']],
    [['ゼミ', 'サークル', '部活', 'ぶかつ', '合宿', 'がっしゅく', '学生', 'がくせい', '大学', 'だいがく', '大学生'], ['ゼミ', 'サークル', '合宿']],
    [['研修', 'けんしゅう', '会議', 'かいぎ', '会社', 'かいしゃ', '企業', 'きぎょう', '法人', 'オフサイト', '社員旅行', 'ミーティング', 'セミナー', 'プロジェクター'], ['研修', '会議', 'プロジェクター']],
    [['スタッフ', '従業員', '管理人', 'かんりにん', '係の人', '店員'], ['スタッフ']],
    [['かぞく', '家族旅行'], ['家族']],
    [['ともだち', '友人', '友だち'], ['友達']],
    [['犬', 'いぬ', '猫', 'ねこ', 'わんちゃん', 'ペット同伴', '動物', 'どうぶつ'], ['ペット']],
    // 泊まる
    [['布団', 'ふとん', 'ベッド', 'ベット', '寝具', 'しんぐ', '枕', 'まくら', '雑魚寝', 'ざこね', '寝る場所', '部屋割り', '部屋割', 'へやわり', '二段ベッド'], ['布団', 'ベッド', '枕']],
    [['へや', '客室', 'きゃくしつ', '寝室'], ['部屋']],
    [['だんじょ'], ['男女']],
    [['暖房', 'だんぼう', '冷房', 'れいぼう', 'クーラー', 'ストーブ', 'ヒーター', '寒い', 'さむい', '暑い', 'あつい', '冷暖房', '空調', 'くうちょう', '寒さ', '暑さ'], ['エアコン']],
    [['アメニティ', 'シャンプー', 'リンス', '石けん', '石鹸', 'せっけん', 'ボディソープ', 'ボディーソープ', '歯みがき', '歯磨き', 'はぶらし'], ['タオル', '歯ブラシ', 'シャンプー', 'ボディーソープ']],
    [['持ち物', 'もちもの', '持っていく', 'もっていく', '持参', 'じさん', '必要なもの', '準備するもの', '用意するもの'], ['持ち物', 'お持ちこみください', '持っていけば']],
    [['鍵', 'かぎ', '施錠', 'せじょう', 'ロック', '個室'], ['鍵', '施錠', '個室']],
    [['洗濯', 'せんたく', '洗濯機', 'せんたくき', 'コインランドリー'], ['洗濯']],
    [['冷蔵庫', 'れいぞうこ'], ['冷蔵庫']],
    [['上履き', 'うわばき', '上靴', 'うわぐつ', 'スリッパ', '室内履き', '靴', 'くつ', 'シューズ'], ['室内履き', '上履き', '靴', 'シューズ']],
    [['自販機', 'じはんき', '自動販売機', 'じどうはんばいき'], ['自動販売機']],
    [['ジュース', 'ドリンク', '飲み物', 'のみもの'], ['自動販売機', 'ドリンク', '飲み物']],
    [['たばこ', 'タバコ', '煙草', '禁煙', 'きんえん', '電子タバコ', '喫煙', 'きつえん', '喫煙所'], ['喫煙', 'タバコ']],
    [['うるさい', '騒音', 'そうおん', '騒ぐ', 'さわぐ', '大声', 'おおごえ', '夜中', 'よなか', '夜遅く', '深夜', 'しんや', '門限', 'もんげん', '静か', 'しずか', '近所', 'きんじょ', '苦情', '夜更かし'], ['騒い', '大音量', '大きな音']],
    [['消灯', 'しょうとう', '電気が消える', '明かり', 'あかり', '就寝'], ['明かりが消える', '騒い']],
    // 食事
    [['バーベキュー', 'ばーべきゅー', '焼肉', '焼き肉', 'やきにく', 'グリル'], ['bbq']],
    [['すみ'], ['炭']],
    [['ご飯', 'ごはん', '食べ物', 'たべもの', 'しょくじ', 'メニュー', '献立', 'こんだて'], ['食事', '給食', '夕食', '朝食', '昼食']],
    [['朝ごはん', 'あさごはん', '朝ご飯', '朝飯', 'あさめし', 'モーニング', 'ちょうしょく'], ['朝食']],
    [['昼ごはん', 'ひるごはん', '昼ご飯', 'お昼', 'おひる', 'ランチ', 'ちゅうしょく', '昼飯'], ['昼食', '給食', '弁当']],
    [['夕飯', 'ゆうはん', '晩ごはん', 'ばんごはん', '晩ご飯', '夜ごはん', 'よるごはん', '夕ご飯', '夕ごはん', 'ディナー', 'ゆうしょく', '晩飯'], ['夕食']],
    [['きゅうしょく', '揚げパン', 'ソフト麺'], ['給食']],
    [['べんとう', 'お弁当'], ['弁当']],
    [['ビール', '生ビール', 'アルコール', '酒', 'さけ', 'おさけ', 'お酒', '飲酒', '酎ハイ', 'チューハイ', 'サワー', 'ハイボール', 'ワイン', '日本酒', '焼酎'], ['お酒', '飲み放題', 'ビール']],
    [['のみほうだい'], ['飲み放題']],
    [['食材', 'しょくざい', '買い出し', 'かいだし', '買い物', 'かいもの', 'スーパー', 'コンビニ', 'お店'], ['食材', 'スーパー', 'コンビニ', '買い出し']],
    [['持込', '持込み', 'もちこみ', '持ちこみ'], ['持ち込', 'お持ちこみ']],
    [['キッチン', '台所', 'だいどころ', '家庭科室', 'かていかしつ', '調理場', '自炊', 'じすい', 'ちょうりしつ', '料理', 'りょうり'], ['調理室', '調理器具', '料理']],
    [['調理器具', 'ちょうりきぐ', '鍋', 'なべ', 'フライパン', '包丁', 'ほうちょう', '炊飯器', 'すいはんき', '炊飯', 'レンジ', '電子レンジ', '食器', 'しょっき', '皿', 'コップ', '紙皿', 'まな板'], ['調理器具', '炊飯器', '鍋', '食器']],
    [['調味料', 'ちょうみりょう', '塩', 'しお', '砂糖', 'さとう', '胡椒', 'こしょう', 'コショウ', '醤油', 'しょうゆ', '味噌', 'みそ'], ['調味料']],
    [['アレルギー', '食物アレルギー', 'アレルゲン', '除去食'], ['アレルギー']],
    // 遊び
    [['きもだめし', '肝だめし', 'お化け', 'おばけ', 'こわい', 'ホラー', '怪談', '心霊', '謎解き', 'なぞとき'], ['肝試し', '謎解き']],
    [['カラオケ', '歌う', 'うたう', 'dam', '映画', 'えいが'], ['カラオケ', '映画']],
    [['こうてい', 'グラウンド', 'ぐらうんど', 'グランド', '運動場', 'うんどうじょう', '遊具', 'ゆうぐ', '外で遊', 'そとで', '屋外', '芝生', 'しばふ'], ['校庭', 'グラウンド']],
    [['たいいくかん', 'バスケ', 'バスケットボール', 'バレー', 'バレーボール', 'ドッジボール', 'ドッジ', '運動', 'うんどう', 'スポーツ', '球技'], ['体育館']],
    [['はなび', '手持ち花火'], ['花火']],
    [['うみ', 'ビーチ', '海水浴', 'かいすいよく', '泳ぐ', 'およぐ', 'サーフィン', '浜'], ['海']],
    [['あめ', '雨天', 'うてん', '天気', 'てんき', '天候', '雨の日', '悪天候'], ['雨']],
    [['おくじょう', 'ルーフ'], ['屋上']],
    [['楽器', 'がっき', '演奏', 'えんそう', 'バンド', '音楽', 'おんがく', 'ピアノ', 'ドラム', '軽音', '音出し'], ['楽器', '音楽']],
    [['コスプレ', '撮影', 'さつえい', '写真', 'しゃしん', 'ロケ', '聖地巡礼'], ['コスプレ', '撮影']],
    [['きょうしつ'], ['教室']],
    [['しょくどう'], ['食堂']],
    [['すきやき'], ['すき焼き']],
    [['きがえ', '着替え', '更衣室', 'こういしつ', 'きがえる'], ['着替え']],
    [['しゅくはく'], ['宿泊']],
    [['とまる', 'とまれる'], ['泊ま']],
    [['あそぶ', 'あそび'], ['遊']],
    [['レストラン', '飲食店', '外食', 'がいしょく', '名物', 'ご当地'], ['レストラン', '名物']],
    [['ライフセーバー', '監視員', '溺れ'], ['ライフセーバー']],
    // 予約・時間
    [['予約', 'よやく', '申し込み', '申込', '申込み', 'もうしこみ', '空き状況', 'あきじょうきょう', '空室', 'くうしつ', '予約方法'], ['予約', '空き状況', '申し込']],
    [['デイユース', '日帰', 'ひがえり', '休憩', 'きゅうけい', '泊まらない'], ['日帰り']],
    [['下見', 'したみ', '内覧', 'ないらん', 'けんがく', '見に行'], ['見学']],
    [['チェックイン', '到着', 'とうちゃく', '何時から', 'なんじから', '入館'], ['チェックイン']],
    [['チェックアウト', '出発', '退館'], ['チェックアウト']],
    [['貸し切り', '貸し切', 'かしきり', '貸切り', '貸し切る', '独占', '専有', 'せんゆう'], ['貸切', '専有']],
    // 行き方・連絡
    [['電車', 'でんしゃ', '新幹線', 'しんかんせん', '駅', 'えき', '最寄り', 'もより', '最寄駅', '公共交通', '路線', 'jr', 'バス停', 'ばすてい'], ['電車', '駅', 'バス停']],
    [['行き方', 'いきかた', 'アクセス', '交通', 'こうつう', '道順', 'ルート', '何分', 'なんぷん', '遠い', 'とおい', '距離', 'きょり', '高速', 'インター', 'ic'], ['電車', '車で', 'インター', 'アクセス']],
    [['くるま', '自動車', 'じどうしゃ', 'マイカー', 'ドライブ'], ['車']],
    [['住所', 'じゅうしょ', '所在地', 'しょざいち', '地図', 'ちず', '郵便番号', 'ばしょ'], ['住所', '地図']],
    [['電話', 'でんわ', '電話番号', 'tel'], ['電話']],
    [['連絡先', 'れんらくさき', '問い合わせ', '問合せ', 'といあわせ', 'メール'], ['電話', 'お問い合わせ']],
    [['駐車', 'ちゅうしゃ', 'ちゅうしゃじょう', 'パーキング', '駐車場', '車を停め', '車を止め'], ['駐車場']],
    [['マイクロバス', '観光バス', '貸切バス', '大型車', 'おおがたばす'], ['大型バス']],
    // 2026-11-25 第6弾 オーナーの答え
    [['蚊', '蚊取り線香', '蚊よけ', 'むし', 'ムカデ', 'ゴキブリ'], ['虫']],
    [['車いす', '車椅子', 'くるまいす', 'バリアフリー', '階段', 'かいだん', 'スロープ', '段差', '多目的トイレ'], ['エレベーター']],
    [['救急', 'きゅうきゅう', 'けが', 'ケガ', '怪我', '病気'], ['病院']],
    [['避難', 'ひなん', '防災', 'ぼうさい', '津波', 'つなみ', '災害'], ['地震']],
    [['ごみ', 'ごみ箱', 'ごみ捨て'], ['ゴミ']],
    [['フロント', 'チェックイン場所', '受付場所', '職員室'], ['受付']],
    [['夜中', 'よなか', '深夜', 'しんや'], ['夜']],
    // 2026-11-25 第7弾 オーナーの答え 21〜45
    [['ワイファイ', 'ネット', 'インターネット', 'wifi', '無線lan'], ['Wi-Fi']],
    [['ハラル', 'ハラール', 'ヴィーガン', 'ビーガン', '菜食', 'ベジ', '宗教食', 'ムスリム'], ['ベジタリアン']],
    [['未成年', 'みせいねん', '同意書', 'どうい', '保護者'], ['高校生']],
    [['少年団', 'しょうねんだん', '学童', 'がくどう', 'スポ少'], ['子ども会']],
    [['電話予約', 'でんわよやく', '電話で予約'], ['電話']],
    // 2026-11-25 祖父母連れ（1階の部屋を選べる）
    [['おじいちゃん', 'おばあちゃん', '祖父母', '高齢', 'お年寄り', '足が悪い'], ['階段']]
  ];

  // 0件のときに出す「近い言葉」。答えそのものは無いが、近い話の質問がある言葉だけ。
  var NEAR = [
    [['シーツ', '毛布', 'もうふ', '寝袋', 'ねぶくろ', '枕カバー'], ['布団']],
    [['パジャマ', '寝間着', '浴衣', 'ゆかた', 'ドライヤー', 'くし', '化粧水', 'ヘアアイロン'], ['持ち物', 'タオル']],
    [['乾燥機', 'かんそうき'], ['洗濯']],
    [['台風', 'たいふう', '大雨', '警報', '荒天'], ['雨', 'キャンセル', '台風']],
    [['送迎', 'そうげい', 'タクシー', 'レンタカー', '迎え', 'むかえ', 'お迎え'], ['電車', '車']],
    [['ゴミ', 'ごみ', 'ゴミ袋', '分別', 'ぶんべつ'], ['片付け']],
    [['病院', 'びょういん', 'ケガ', 'けが', '怪我', '救急', '体調'], ['スタッフ']],
    [['防犯', 'ぼうはん', 'セキュリティ', '貴重品', '不審者'], ['貸切', '鍵']],
    [['プール', '釣り', 'つり', '川'], ['海']],
    [['クーポン', '学割', 'がくわり', 'ポイント'], ['割引']],
    [['冷凍庫', 'れいとうこ', '氷', 'こおり'], ['冷蔵庫']],
    [['焚き火', 'たきび', 'キャンプファイヤー'], ['花火', 'BBQ']]
  ];

  // 的外れの当たりを減らす：左の言葉で探すときは、右の言葉を答えから外して探す。
  // （「バス」でバスタオル・バスケ、「におい」で「海においては」、「学生」で小学生 など）
  var NOISE = {
    'バス': ['バスタオル', 'バスケ'],
    'におい': ['においては', 'において'],
    '学生': ['小学生'],
    'ふろ': ['フロア'],
    'ヒーター': ['クッキングヒーター'],
    '会議': ['施錠が出来る会議室'],
    '醤油': ['醤油皿']
  };

  // 書き方のゆれ：言葉の中のこの部分を置きかえて、もう一度探す（例：子供料金→子ども料金）
  var VARIANTS = [
    ['子供', '子ども'], ['こども', '子ども'],
    ['貸し切り', '貸切'], ['貸し切', '貸切'], ['貸切り', '貸切'],
    ['見積もり', '見積'], ['見積り', '見積'],
    ['バーベキュー', 'BBQ'],
    ['持込み', '持ち込み'], ['持込', '持ち込'], ['持ちこみ', '持ち込み'],
    ['申込み', '申し込み'], ['申込', '申し込'],
    ['何名', '何人'],
    ['ベット', 'ベッド']
  ];

  function buildMap(list) {
    var map = {};
    list.forEach(function (pair) {
      var to = pair[1].map(norm);
      pair[0].forEach(function (k) {
        var key = norm(k);
        map[key] = (map[key] || []).concat(to);
      });
    });
    return map;
  }
  var SYN = buildMap(SYNONYMS);
  var NOISEMAP = {};
  Object.keys(NOISE).forEach(function (k) { NOISEMAP[norm(k)] = NOISE[k].map(norm); });
  var VARS = VARIANTS.map(function (v) { return [norm(v[0]), norm(v[1])]; });
  // 近い言葉は、ボタンに出すので書いたままの形で持つ
  var NEARMAP = {};
  NEAR.forEach(function (pair) {
    pair[0].forEach(function (k) { var key = norm(k); NEARMAP[key] = (NEARMAP[key] || []).concat(pair[1]); });
  });

  // 検索の言葉を分ける：空白・「、」・「・」などで区切る。
  // 漢字・カタカナにはさまれた「は・の・を」などの助詞でも区切る（例：「駐車場は無料」「お酒の持ち込み」）。
  // 返すのは [{ n: 探す形, raw: 入れたままの形 }]
  var HIRA = 'ぁ-ゟ';
  var PARTICLES = '(?:って|とか|は|が|を|の|と|や|も|で|に)';
  var PARTICLE_RE = new RegExp('([^' + HIRA + '\\s])' + PARTICLES + '(?=[^' + HIRA + '\\s])', 'g');
  var TRAIL_RE = new RegExp('([^' + HIRA + '])' + PARTICLES + '$');
  var TRAIL_ANY_RE = new RegExp('^(.{2,})' + PARTICLES + '$');
  var PARTICLE_LOOSE_RE = new RegExp('([' + HIRA + '])' + PARTICLES + '(?=[^' + HIRA + '\\s])', 'g');
  function splitTerms(raw, loose) {
    var s = String(raw || '');
    if (s.normalize) { s = s.normalize('NFKC'); }
    s = s.replace(PARTICLE_RE, '$1 ');
    // loose：ひらがなの後ろの助詞でも区切る（「子どもの料金」）。ふつうに探して0件のときだけ使う
    if (loose) { s = s.replace(PARTICLE_LOOSE_RE, '$1 '); }
    var parts = s.split(/[\s、。,・\/?!「」『』()]+/);
    var out = [];
    var seen = [];
    parts.forEach(function (p) {
      p = p.replace(TRAIL_RE, '$1');
      var n = norm(p);
      if (n && seen.indexOf(n) === -1) { seen.push(n); out.push({ n: n, raw: p }); }
    });
    return out;
  }

  // 1つの言葉で当てる先（その言葉・ゆれを直した言葉・言い換え）
  function altsOf(term) {
    var list = [term];
    // 「日帰りで」「子どもの」のように、ひらがなの後ろの助詞は、漢字をふくむときだけ外した形も試す
    var m = term.match(TRAIL_ANY_RE);
    if (m && new RegExp('[^' + HIRA + ']').test(m[1])) { list.push(m[1]); }
    list.slice().forEach(function (t) {
      VARS.forEach(function (v) {
        if (t.indexOf(v[0]) !== -1) {
          var t2 = t.split(v[0]).join(v[1]);
          if (list.indexOf(t2) === -1) { list.push(t2); }
        }
      });
    });
    list.slice().forEach(function (t) {
      (SYN[t] || []).forEach(function (s) { if (list.indexOf(s) === -1) { list.push(s); } });
    });
    return list;
  }
  function textHas(i, alt) {
    var t = texts[i];
    var ng = NOISEMAP[alt];
    if (ng) { ng.forEach(function (w) { t = t.split(w).join(''); }); }
    return t.indexOf(alt) !== -1;
  }
  function itemHasTerm(i, alts) {
    for (var k = 0; k < alts.length; k++) { if (textHas(i, alts[k])) { return true; } }
    return false;
  }
  function search(terms) {
    var altsList = terms.map(function (t) { return altsOf(t.n); });
    var hits = [];
    items.forEach(function (d, i) {
      var ok = altsList.every(function (alts) { return itemHasTerm(i, alts); });
      if (ok) { hits.push(i); }
    });
    return hits;
  }
  // ふつうに区切って0件なら、ひらがなの後ろの助詞でも区切ってもう一度
  function find(raw) {
    var terms = splitTerms(raw);
    var hits = terms.length ? search(terms) : [];
    if (terms.length && !hits.length) {
      var loose = splitTerms(raw, true);
      if (loose.length > terms.length) {
        var hits2 = search(loose);
        if (hits2.length) { return { terms: loose, hits: hits2 }; }
      }
    }
    return { terms: terms, hits: hits };
  }
  function countFor(word) { return find(word).hits.length; }

  var input = document.getElementById('faq-search');
  var result = document.getElementById('faq-search-result');
  var suggest = document.getElementById('faq-search-suggest');
  var zero = document.getElementById('faq-search-zero');
  var clearBtn = document.getElementById('faq-search-clear');
  var OPEN_MAX = 5;
  var composing = false;

  // 0件の言葉を dataLayer に入れる（打ち終わって1.5秒そのままのとき、同じ言葉は1回だけ）
  var zeroTimer = null;
  var zeroSent = {};
  function queueZero(raw) {
    clearTimeout(zeroTimer);
    zeroTimer = setTimeout(function () {
      var q = String(raw || '').trim().slice(0, 50);
      if (!q || zeroSent[q] || !input || input.value.trim() !== String(raw).trim()) { return; }
      zeroSent[q] = true;
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'faq_search_zero', faq_query: q });
    }, 1500);
  }

  // 0件のときの近い言葉：2語以上なら1語ずつで当たる言葉、それと NEAR の言葉（どれも当たるものだけ）
  function nearWords(terms) {
    var out = [];
    function add(w) { if (w && out.indexOf(w) === -1 && countFor(w) > 0) { out.push(w); } }
    if (terms.length > 1) {
      terms.forEach(function (t) { add(t.raw); });
    }
    terms.forEach(function (t) {
      altsOf(t.n).forEach(function (a) { (NEARMAP[a] || []).forEach(add); });
    });
    return out.slice(0, 4);
  }

  function showSuggest(words) {
    if (!suggest) { return; }
    suggest.textContent = '';
    if (!words.length) { suggest.hidden = true; return; }
    var label = document.createElement('span');
    label.className = 'top-v2-faq-suggest-label';
    label.textContent = '近い言葉で探す：';
    suggest.appendChild(label);
    words.forEach(function (w) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'top-v2-faq-suggest-btn';
      b.setAttribute('data-event', 'faq_zero_suggest');
      b.textContent = w;
      b.addEventListener('click', function () {
        input.value = w;
        apply();
      });
      suggest.appendChild(b);
    });
    suggest.hidden = false;
  }

  function apply(e) {
    var raw = input ? input.value : '';
    var found = find(raw);
    var terms = found.terms;
    var hits = found.hits;
    var isComposing = composing || (e && e.isComposing);
    // 変換の途中は、0件でも画面を変えない（「見つかりません」を出さない）
    if (isComposing && terms.length && !hits.length) { return; }

    var hitSet = {};
    hits.forEach(function (i) { hitSet[i] = true; });
    items.forEach(function (d, i) {
      var hit = !terms.length || !!hitSet[i];
      d.hidden = !hit;
      // 検索で開いたものは、検索が変わったら閉じ直す
      if (d.dataset.searchOpened && (!hit || !terms.length)) { d.open = false; delete d.dataset.searchOpened; }
    });
    if (terms.length && hits.length <= OPEN_MAX) {
      hits.forEach(function (i) { var d = items[i]; if (!d.open) { d.open = true; d.dataset.searchOpened = '1'; } });
    }
    sections.forEach(function (s) { s.hidden = !!terms.length && !s.querySelector('details.faq:not([hidden])'); });

    var isZero = !!terms.length && !hits.length;
    if (zero) { zero.hidden = !isZero; }
    if (!isZero) { clearTimeout(zeroTimer); showSuggest([]); }
    if (!result) { return; }
    if (!terms.length) {
      result.hidden = true;
      result.textContent = '';
    } else if (hits.length) {
      result.hidden = false;
      result.textContent = hits.length + '件の質問が見つかりました';
    } else {
      result.hidden = false;
      var shown = String(raw).trim();
      if (shown.length > 30) { shown = shown.slice(0, 30) + '…'; }
      result.textContent = '『' + shown + '』に合う質問は、まだありません。';
      showSuggest(nearWords(terms));
      queueZero(raw);
    }
  }

  if (input) {
    input.addEventListener('compositionstart', function () { composing = true; });
    input.addEventListener('compositionend', function () { composing = false; apply(); });
    input.addEventListener('input', apply);
    // 検索欄でEnterを押してもページは送らない（変換を決めるEnterはそのまま）
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); input.blur(); }
    });
  }

  function clearSearch() {
    if (!input || !input.value) { return; }
    input.value = '';
    apply();
  }
  // 分類ボタン：検索中に押したら、検索を消してからその分類へ（既定のページ内移動はそのまま）
  Array.prototype.forEach.call(document.querySelectorAll('.top-v2-faq-cats a[href^="#"]'), function (a) {
    a.addEventListener('click', clearSearch);
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      clearSearch();
      if (input) { input.focus(); }
    });
  }

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) { return; }
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
