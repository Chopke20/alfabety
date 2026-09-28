/* Polski alfabet (32 litery) i ocenianie wymowy dziecka. */
(function () {
  function norm(s) {
    return String(s || "")
      .toLocaleLowerCase("pl-PL")
      .replace(/[^0-9a-ząćęłńóśźż\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function foldPl(s) {
    var map = { "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z" };
    return s.replace(/[ąćęłńóśźż]/g, function (ch) { return map[ch]; });
  }

  function collapse(token) {
    return token.replace(/(.)\1+/g, "$1");
  }

  function make(ch, lower, name, word, emoji, caption, extra, near, nearHint) {
    var say = [];
    function push(v) {
      var n = norm(v);
      if (n && say.indexOf(n) === -1) say.push(n);
    }
    push(ch);
    push(lower);
    push(name);
    push(word);
    push(caption);
    var folded = foldPl(norm(word));
    if (folded.length >= 3) push(folded);
    (extra || []).forEach(push);
    return {
      ch: ch,
      lower: lower,
      name: name,
      word: word,
      emoji: emoji,
      caption: caption,
      speech: name + ". " + caption + ".",
      say: say,
      near: near || [],
      nearHint: nearHint || "Prawie! Posłuchaj jeszcze raz."
    };
  }

  function packOf(transcript) {
    var n = norm(transcript);
    if (!n) return { n: "", collapsed: "", tokens: new Set() };
    var collapsed = n.split(" ").map(collapse).join(" ");
    var tokens = new Set();
    n.split(" ").forEach(function (t) { tokens.add(t); });
    collapsed.split(" ").forEach(function (t) { tokens.add(t); });
    return { n: n, collapsed: collapsed, tokens: tokens };
  }

  function hasPhrase(list, pack) {
    return (list || []).some(function (item) {
      var a = norm(item);
      return a.indexOf(" ") !== -1 && (pack.n.indexOf(a) !== -1 || pack.collapsed.indexOf(a) !== -1);
    });
  }

  function hasToken(list, pack) {
    return (list || []).some(function (item) {
      var a = norm(item);
      return a && a.indexOf(" ") === -1 && pack.tokens.has(a);
    });
  }

  function judge(letter, transcript) {
    var pack = packOf(transcript);
    if (!pack.n) return "empty";
    if (hasPhrase(letter.say, pack)) return "ok";
    if (hasPhrase(letter.near, pack)) return "near";
    if (hasToken(letter.say, pack)) return "ok";
    if (hasToken(letter.near, pack)) return "near";
    return "no";
  }

  var letters = [
    make("A", "a", "a", "arbuz", "🍉", "A jak arbuz", [], ["ą", "a z ogonkiem", "a ogonkiem"], "To jest a, bez ogonka."),
    make("Ą", "ą", "ą", "łąka", "🌿", "Ą jak w wyrazie łąka", ["a z ogonkiem", "a ogonkiem", "ą z ogonkiem"], ["a"], "Prawie! To jest a z ogonkiem."),
    make("B", "b", "be", "balon", "🎈", "B jak balon", ["by", "bee", "beh"], [], "Posłuchaj jeszcze raz."),
    make("C", "c", "ce", "cukierek", "🍬", "C jak cukierek", ["cy", "see"], ["ć", "cie", "ćma", "cma"], "To brzmi jak ć, c z kreską."),
    make("Ć", "ć", "cie", "ćma", "🦋", "Ć jak ćma", ["ci", "cze"], ["c", "ce", "cukierek"], "Prawie! To jest cie, c z kreską."),
    make("D", "d", "de", "domek", "🏠", "D jak domek", ["dy", "dee"], [], "Posłuchaj jeszcze raz."),
    make("E", "e", "e", "echo", "📣", "E jak echo", [], ["ę", "e z ogonkiem", "e ogonkiem"], "To jest e, bez ogonka."),
    make("Ę", "ę", "ę", "ręka", "✋", "Ę jak w wyrazie ręka", ["e z ogonkiem", "e ogonkiem", "ę z ogonkiem"], ["e"], "Prawie! To jest e z ogonkiem."),
    make("F", "f", "ef", "flaga", "🚩", "F jak flaga", ["fe"], [], "Posłuchaj jeszcze raz."),
    make("G", "g", "gie", "gruszka", "🍐", "G jak gruszka", ["ge", "gi"], [], "Posłuchaj jeszcze raz."),
    make("H", "h", "ha", "helikopter", "🚁", "H jak helikopter", ["cha"], [], "Posłuchaj jeszcze raz."),
    make("I", "i", "i", "iglo", "❄️", "I jak iglo", [], ["igrek", "y", "yeti"], "To jest i, a nie igrek."),
    make("J", "j", "jot", "jabłko", "🍎", "J jak jabłko", ["ji", "je"], [], "Posłuchaj jeszcze raz."),
    make("K", "k", "ka", "kot", "🐱", "K jak kot", ["kay"], [], "Posłuchaj jeszcze raz."),
    make("L", "l", "el", "lody", "🍦", "L jak lody", ["le"], ["ł", "eł", "łódka", "lodka"], "To jest el, bez kreski."),
    make("Ł", "ł", "eł", "łódka", "⛵", "Ł jak łódka", ["ew", "eu", "l z kreska", "l z kreską"], ["l", "el", "lody"], "Prawie! To jest eł, l z kreską."),
    make("M", "m", "em", "miś", "🐻", "M jak miś", ["me", "mis"], [], "Posłuchaj jeszcze raz."),
    make("N", "n", "en", "nos", "👃", "N jak nos", ["ne"], ["ń", "eń", "ogień", "ogien"], "To jest en, bez kreski."),
    make("Ń", "ń", "eń", "ogień", "🔥", "Ń jak w wyrazie ogień", ["ni", "n z kreska", "n z kreską"], ["n", "en", "nos"], "Prawie! To jest eń, n z kreską."),
    make("O", "o", "o", "oko", "👀", "O jak oko", [], ["ó", "u kreskowane", "ósemka", "osemka", "u z kreską"], "To jest o, bez kreski."),
    make("Ó", "ó", "u kreskowane", "ósemka", "8️⃣", "Ó jak ósemka", ["u z kreska", "u z kreską", "o z kreska", "o z kreską", "o kreskowane", "u zamkniete", "u zamknięte", "osiemka", "8"], ["u", "o", "oko"], "Prawie! To jest u z kreską."),
    make("P", "p", "pe", "pies", "🐶", "P jak pies", ["py", "pee"], [], "Posłuchaj jeszcze raz."),
    make("R", "r", "er", "rakieta", "🚀", "R jak rakieta", ["re"], [], "Posłuchaj jeszcze raz."),
    make("S", "s", "es", "słońce", "☀️", "S jak słońce", ["se"], ["ś", "eś", "ślimak", "slimak"], "To jest es, bez kreski."),
    make("Ś", "ś", "eś", "ślimak", "🐌", "Ś jak ślimak", ["si", "esz", "s z kreska", "s z kreską"], ["s", "es", "słońce", "slonce"], "Prawie! To jest eś, s z kreską."),
    make("T", "t", "te", "tygrys", "🐯", "T jak tygrys", ["ty", "tee"], [], "Posłuchaj jeszcze raz."),
    make("U", "u", "u", "ucho", "👂", "U jak ucho", [], ["ó", "u kreskowane", "u z kreską", "u z kreska", "ósemka", "osemka"], "To jest u, bez kreski."),
    make("W", "w", "wu", "wieloryb", "🐋", "W jak wieloryb", ["vu", "v"], [], "Posłuchaj jeszcze raz."),
    make("Y", "y", "igrek", "yeti", "☃️", "Y jak yeti", ["igreka", "i grek", "ygrek", "jety"], ["i", "iglo"], "To jest igrek, a nie i."),
    make("Z", "z", "zet", "zebra", "🦓", "Z jak zebra", ["ze", "zed", "set"], ["ź", "ż", "ziet", "żet", "żaba", "zaba", "źrebak", "zrebak"], "Posłuchaj: to jest zet."),
    make("Ź", "ź", "ziet", "źrebak", "🐴", "Ź jak źrebak", ["zi", "z z kreska", "z z kreską", "z kreskowane"], ["z", "zet", "ż", "żet", "żaba", "zaba"], "Prawie! To jest ziet, z z kreską."),
    make("Ż", "ż", "żet", "żaba", "🐸", "Ż jak żaba", ["zy", "zet z kropka", "zet z kropką", "z z kropka", "z z kropką", "rz"], ["z", "zet", "ź", "ziet", "źrebak", "zrebak"], "Prawie! To jest żet, z z kropką.")
  ];

  letters.forEach(function (letter, index) { letter.i = index; });

  window.ALFABET = { letters: letters, judge: judge, norm: norm };
})();
