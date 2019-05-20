var json_language = {
    english: {
        _init_settings_: "Startup settings",
        _personal_data_: "Personal data",
        _personal_data_explain_: "Your last saved data should automatically be filled in, or you can copy-paste a backup file here.<br><i>*For new users only: Leave Empty</i>",
        _master_data_: "Master data",
        _master_data_explain_: "Master data is loaded from the server, if the loading is slow, then please wait for \"Loaded!\" to appear in the text box.",
        _color_settings_: "Color settings",
        _color_normal_: "Normal",
        _color_dark_: "Dark",
        _start_tool_: "Start GCS tool"
    },
    japanese: {
        _init_settings_: "初期設定",
        _personal_data_: "個人データ",
        _personal_data_explain_: "一番最近セーブしたデータは自動的に記入される、そしてバックアップデータのコピーペーストも可能です。<br><i>※新しいユーザーのみ：空にしてください。</i>",
        _master_data_: "マスターデータ",
        _master_data_explain_: "マスターデータファイルはサーバから取得する、もし遅かったら、テクストボックスに「ロード済み！」が表示されるまでお待ちください。",
        _color_settings_: "カラー設定",
        _color_normal_: "普通",
        _color_dark_: "ダーク",
        _start_tool_: "GCSツールを開始"
    },
    swedish: {
        _init_settings_: "Starta inställningar",
        _personal_data_: "Personlig data",
        _personal_data_explain_: "Din senaste sparade data fylls in automatiskt, men du kan också kopiera-klistra in säkerhets sparad data.<br><i>*För nya användare: Lämna tom</i>",
        _master_data_: "Mästar data",
        _master_data_explain_: "Mästar data laddas ner från servern, om nerladdningen är långsam, vänta på att \"Laddad!\" dycker up i text rutan.",
        _color_settings_: "Färg inställningar",
        _color_normal_: "Normal",
        _color_dark_: "Mörk",
        _start_tool_: "Starta GCS verktyget"
    }
}

/*
*/

function UpdateLanguage(source) {
    var language_id = document.getElementById(source).value;
    var z = document.getElementsByTagName("*");

    for (var i = 0; i < z.length; i++) {
        var elmnt = z[i];
        var lval = elmnt.getAttribute("lg_language");
        if (lval) {
            elmnt.innerHTML = json_language[language_id][lval];
        }
    }
}
UpdateLanguage("lg_language");