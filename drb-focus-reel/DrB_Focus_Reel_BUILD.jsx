/*  Dr. B — FOCUS Chocolate Tabs  |  Reel 9:16 (1080x1920, 30fps, 16.5s)
    Builds the full, editable After Effects project from the files next to this script,
    then saves it as DrB_Focus_Reel.aep in the same folder.

    How to run:  After Effects > File > Scripts > Run Script File...  > DrB_Focus_Reel_BUILD.jsx
    Requires:    Montserrat installed (fonts/ folder) — Light / Regular / Medium / SemiBold / Bold
    Built-in effects only (no plugins).
*/
(function () {
    var ROOT = new File($.fileName).parent;
    var W = 1080, H = 1920, FPS = 30, DUR = 16.5;
    var GOLD = [0.91, 0.71, 0.35], GOLD_HI = [0.98, 0.87, 0.59], CREAM = [0.96, 0.94, 0.91];

    // ------------------------------------------------------------ helpers
    function f(rel) {
        var file = new File(ROOT.fsName + "/" + rel);
        if (!file.exists) { throw new Error("Missing file: " + file.fsName); }
        return file;
    }
    function importFile(rel, folder) {
        var it = app.project.importFile(new ImportOptions(f(rel)));
        it.parentFolder = folder;
        return it;
    }
    function easeAll(prop, influence) {
        influence = influence || 75;
        for (var k = 1; k <= prop.numKeys; k++) {
            var dims = 1;
            var vt = prop.propertyValueType;
            if (vt !== PropertyValueType.TwoD_SPATIAL && vt !== PropertyValueType.ThreeD_SPATIAL) {
                var v = prop.keyValue(k);
                dims = (v instanceof Array) ? v.length : 1;
            }
            var e = [];
            for (var d = 0; d < dims; d++) { e.push(new KeyframeEase(0, influence)); }
            try { prop.setTemporalEaseAtKey(k, e, e); } catch (err) {}
        }
    }
    // keys: [[time, value], ...]
    function keys(prop, list, influence) {
        for (var i = 0; i < list.length; i++) { prop.setValueAtTime(list[i][0], list[i][1]); }
        easeAll(prop, influence);
        return prop;
    }
    function tr(layer, name) { return layer.property("ADBE Transform Group").property(name); }
    function fx(layer, matchName) { return layer.property("ADBE Effect Parade").addProperty(matchName); }
    function blur(layer) {
        var b = fx(layer, "ADBE Gaussian Blur 2");
        b.property("ADBE Gaussian Blur 2-0003").setValue(1); // repeat edge pixels
        return b.property("ADBE Gaussian Blur 2-0001");
    }
    function setByName(effect, name, value) {
        try { effect.property(name).setValue(value); } catch (e) {}
    }

    // Text layers: addText can fail (Unknown BIB Error / CT) when AE's Text Engine is set to
    // "South Asian and Middle Eastern". Try several ways, then explain the fix instead of crashing.
    function makeText(comp, str) {
        var l = null;
        try { l = comp.layers.addText(new TextDocument(str)); } catch (e) { l = null; }
        if (!l) { try { l = comp.layers.addText(str); } catch (e2) { l = null; } }
        if (!l) {
            try {
                l = comp.layers.addText();
                l.property("ADBE Text Properties").property("ADBE Text Document").setValue(new TextDocument(str));
            } catch (e3) { l = null; }
        }
        if (!l) {
            throw new Error("After Effects couldn't create a text layer.\n\n" +
                "Fix: Edit > Preferences > Type > Text Engine = \"Latin and East Asian\", " +
                "restart After Effects, then run this script again.");
        }
        return l;
    }
    function textDoc(st, str) {
        var td = null;
        try { td = st.value; } catch (e) { td = null; }
        if (!td) { td = new TextDocument(str); }
        try { td.resetCharStyle(); } catch (e2) {}
        return td;
    }

    function textLayer(comp, str, font, size, color, tracking, x, y, justify) {
        var l = makeText(comp, str);
        var st = l.property("ADBE Text Properties").property("ADBE Text Document");
        var td = textDoc(st, str);
        td.font = font;
        td.fontSize = size;
        td.applyFill = true;
        td.fillColor = color;
        td.applyStroke = false;
        td.tracking = tracking || 0;
        td.justification = justify || ParagraphJustification.CENTER_JUSTIFY;
        st.setValue(td);
        tr(l, "ADBE Position").setValue([x, y]);
        l.name = str;
        return l;
    }

    // Blur-fade-rise in, blur-fade out — the text move used through the whole reel
    function textInOut(l, tIn, tOut, rise) {
        rise = rise === undefined ? 30 : rise;
        var p = tr(l, "ADBE Position"), base = p.value;
        keys(p, [[tIn, [base[0], base[1] + rise]], [tIn + 0.6, base]]);
        var o = tr(l, "ADBE Opacity");
        var ok = [[tIn, 0], [tIn + 0.6, 100]];
        var b = blur(l);
        var bk = [[tIn, 10], [tIn + 0.6, 0]];
        if (tOut) { ok.push([tOut - 0.3, 100], [tOut, 0]); bk.push([tOut - 0.3, 0], [tOut, 12]); }
        keys(o, ok); keys(b, bk);
        return l;
    }

    function beamLayer(comp, name, x, y, width, angle, color, opacity, softness) {
        var s = comp.layers.addShape();
        s.name = name;
        var g = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var r = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([width, 4200]);
        var fl = g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        fl.property("ADBE Vector Fill Color").setValue(color);
        tr(s, "ADBE Position").setValue([x, y]);
        tr(s, "ADBE Rotate Z").setValue(angle);
        tr(s, "ADBE Opacity").setValue(opacity);
        blur(s).setValue(softness || 160);
        s.blendingMode = BlendingMode.ADD;
        return s;
    }

    function vignette(comp) {
        var v = comp.layers.addSolid([1, 1, 1], "Vignette", W, H, 1);
        var r = fx(v, "ADBE Ramp");
        r.property("ADBE Ramp-0001").setValue([W / 2, H / 2]);
        r.property("ADBE Ramp-0002").setValue([1, 1, 1]);
        r.property("ADBE Ramp-0003").setValue([W / 2 + 1150, H / 2]);
        r.property("ADBE Ramp-0004").setValue([0, 0, 0]);
        r.property("ADBE Ramp-0005").setValue(2); // radial
        v.blendingMode = BlendingMode.MULTIPLY;
        tr(v, "ADBE Opacity").setValue(70);
        return v;
    }

    function darkGradient(comp, name, topAmount, bottomAmount) {
        // black overlay that is strong at the top (and/or bottom) so the copy reads
        var make = function (nm, fromY, toY, amt) {
            var s = comp.layers.addSolid([0, 0, 0], nm, W, H, 1);
            var r = fx(s, "ADBE Ramp");
            r.property("ADBE Ramp-0001").setValue([W / 2, fromY]);
            r.property("ADBE Ramp-0002").setValue([1, 1, 1]);
            r.property("ADBE Ramp-0003").setValue([W / 2, toY]);
            r.property("ADBE Ramp-0004").setValue([0, 0, 0]);
            // use the ramp as luminance → alpha
            var sh = fx(s, "ADBE Shift Channels");
            sh.property("ADBE Shift Channels-0001").setValue(5); // alpha from luminance
            sh.property("ADBE Shift Channels-0002").setValue(11); // RGB = full off (black)
            sh.property("ADBE Shift Channels-0003").setValue(11);
            sh.property("ADBE Shift Channels-0004").setValue(11);
            tr(s, "ADBE Opacity").setValue(amt);
            return s;
        };
        var out = [];
        if (topAmount) { out.push(make(name + " Top", 0, H * 0.45, topAmount)); }
        if (bottomAmount) { out.push(make(name + " Bottom", H, H * 0.55, bottomAmount)); }
        return out;
    }

    function lightSweep(layer, tStart, tEnd, fromX, toX, y, width) {
        var s = fx(layer, "CC Light Sweep");
        setByName(s, "Direction", -30);
        setByName(s, "Width", width || 60);
        setByName(s, "Sweep Intensity", 60);
        setByName(s, "Edge Intensity", 80);
        setByName(s, "Light Color", GOLD_HI);
        try { keys(s.property("Center"), [[tStart, [fromX, y]], [tEnd, [toX, y]]]); } catch (e) {}
        return s;
    }

    function arrowLayer(comp, name, x, y, t0) {
        var s = comp.layers.addShape();
        s.name = name;
        var root = s.property("ADBE Root Vectors Group");
        var g = root.addProperty("ADBE Vector Group");
        g.name = "Arrow";
        var vg = g.property("ADBE Vectors Group");
        var shaft = new Shape(); shaft.vertices = [[0, 58], [0, -54]]; shaft.closed = false;
        var head = new Shape(); head.vertices = [[-30, -24], [0, -58], [30, -24]]; head.closed = false;
        vg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(shaft);
        vg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(head);
        var st = vg.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(GOLD);
        st.property("ADBE Vector Stroke Width").setValue(13);
        st.property("ADBE Vector Stroke Line Cap").setValue(2);  // round
        st.property("ADBE Vector Stroke Line Join").setValue(2);
        var trim = root.addProperty("ADBE Vector Filter - Trim");
        keys(trim.property("ADBE Vector Trim End"), [[t0, 0], [t0 + 0.6, 100]]);
        tr(s, "ADBE Position").setValue([x, y]);
        keys(tr(s, "ADBE Opacity"), [[t0, 0], [t0 + 0.15, 100]]);
        // keeps nudging upward after it lands — "boost"
        tr(s, "ADBE Position").expression =
            "t = time - " + (t0 + 0.7) + ";\nt > 0 ? value + [0, -6*Math.sin(t*3.2)] : value;";
        var gl = fx(s, "ADBE Glo2");
        gl.property("ADBE Glo2-0002").setValue(50);
        gl.property("ADBE Glo2-0003").setValue(25);
        gl.property("ADBE Glo2-0004").setValue(0.6);
        return s;
    }

    // ------------------------------------------------------------ project
    // warn early if Montserrat isn't installed (AE 24+ exposes app.fonts)
    (function () {
        var need = ["Montserrat-Light", "Montserrat-Medium", "Montserrat-SemiBold", "Montserrat-Bold"], missing = [];
        try {
            for (var i = 0; i < need.length; i++) {
                var r = app.fonts.getFontsByPostScriptName(need[i]);
                if (!r || !r.length) { missing.push(need[i]); }
            }
        } catch (e) { return; }
        if (missing.length && !confirm("Missing fonts:\n" + missing.join("\n") +
            "\n\nInstall them from the fonts folder (right-click > Install for all users) and restart AE.\nContinue anyway?")) {
            throw new Error("Cancelled: install the Montserrat fonts first.");
        }
    })();
    app.beginUndoGroup("Build Dr B Focus Reel");
    if (!app.project) { app.newProject(); }
    var proj = app.project;
    var fRoot = proj.items.addFolder("DrB_Focus_Reel");
    var fAssets = proj.items.addFolder("Assets"); fAssets.parentFolder = fRoot;
    var fComps = proj.items.addFolder("Precomps"); fComps.parentFolder = fRoot;

    var podium = importFile("assets/scene_podium.png", fAssets);
    var notebook = importFile("assets/scene_notebook.png", fAssets);
    var pack = importFile("assets/focus_pack.png", fAssets);
    var logo = importFile("assets/drb_logo_gold.png", fAssets);
    var music = importFile("audio/drb_focus_score.wav", fAssets);

    function newComp(name, folder) {
        var c = proj.items.addComp(name, W, H, 1, DUR, FPS);
        c.bgColor = [0.04, 0.03, 0.02];
        if (folder) { c.parentFolder = folder; }
        return c;
    }

    // Shared dark studio background with the diagonal shaft (scenes 2 + 4)
    var studio = newComp("BG_Studio", fComps);
    (function () {
        var base = studio.layers.addSolid([0.055, 0.043, 0.031], "Base", W, H, 1);
        var n = fx(base, "ADBE Fractal Noise");
        setByName(n, "Contrast", 60);
        setByName(n, "Brightness", -20);
        setByName(n, "Scale", 40);
        try { n.property("Blending Mode").setValue(5); } catch (e) {}
        setByName(n, "Opacity", 25);
        beamLayer(studio, "Light Shaft", W / 2 - 100, H / 2 - 60, 520, -32, [0.67, 0.46, 0.2], 85, 180);
    })();

    // Gold dust: 45 drifting motes driven by expressions (edit "Dust Count" by duplicating)
    var dust = newComp("FX_GoldDust", fComps);
    (function () {
        for (var i = 1; i <= 45; i++) {
            var s = dust.layers.addShape();
            s.name = "mote " + i;
            var g = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            var e = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Ellipse");
            var size = 3 + Math.random() * 6;
            e.property("ADBE Vector Ellipse Size").setValue([size, size]);
            g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill")
                .property("ADBE Vector Fill Color").setValue(GOLD_HI);
            tr(s, "ADBE Position").expression =
                "seedRandom(index, true);\n" +
                "var x0 = random(0, thisComp.width), y0 = random(0, thisComp.height), v = random(8, 30), ph = random(0, 6.28);\n" +
                "var y = ((y0 - v*time) % thisComp.height + thisComp.height) % thisComp.height;\n" +
                "[x0 + 18*Math.sin(time*0.6 + ph), y];";
            tr(s, "ADBE Opacity").expression =
                "seedRandom(index, true); var ph = random(0, 6.28);\n55 + 45*Math.sin(time*2.2 + ph*3);";
            blur(s).setValue(1.5);
        }
    })();

    // ---------------------------------------------------------- 01 HOOK  (0 – 5.6s)
    var hook = newComp("01_Hook", fComps);
    (function () {
        var bg = hook.layers.add(podium);
        keys(tr(bg, "ADBE Scale"), [[0, [118, 118, 100]], [5.6, [100, 100, 100]]], 10);
        keys(blur(bg), [[1.3, 22], [2.7, 0]]);                      // the rack focus
        darkGradient(hook, "Text Shade", 90, 0);
        var sweep = beamLayer(hook, "Light Pass", -500, H / 2, 260, -32, GOLD_HI, 22, 120);
        keys(tr(sweep, "ADBE Position"), [[3.3, [-500, H / 2]], [5.2, [W + 500, H / 2]]]);

        textInOut(textLayer(hook, "been losing", "Montserrat-Light", 78, CREAM, 50, 540, 495), 0.25, 3.2);

        // "focus lately?" — two layers so "focus" can sit out of focus until the rack
        var lFocus = textLayer(hook, "focus", "Montserrat-Bold", 104, GOLD, 40, 0, 625, ParagraphJustification.LEFT_JUSTIFY);
        var lLately = textLayer(hook, " lately?", "Montserrat-Light", 78, CREAM, 50, 0, 625, ParagraphJustification.LEFT_JUSTIFY);
        var w1 = lFocus.sourceRectAtTime(0, false).width, w2 = lLately.sourceRectAtTime(0, false).width;
        var x0 = (W - (w1 + w2 + 12)) / 2;
        tr(lFocus, "ADBE Position").setValue([x0, 625]);
        tr(lLately, "ADBE Position").setValue([x0 + w1 + 12, 625]);
        textInOut(lLately, 0.55, 3.2);
        textInOut(lFocus, 0.55, 3.2);
        var fb = lFocus.property("ADBE Effect Parade").property(1).property("ADBE Gaussian Blur 2-0001");
        while (fb.numKeys) { fb.removeKey(1); }
        keys(fb, [[0.55, 10], [1.2, 9], [2.6, 0], [2.9, 0], [3.2, 12]]);
        var gl = fx(lFocus, "ADBE Glo2"); gl.property("ADBE Glo2-0003").setValue(30); gl.property("ADBE Glo2-0004").setValue(0.5);

        textInOut(textLayer(hook, "that's okay,", "Montserrat-Light", 72, CREAM, 50, 540, 495), 3.3, 5.6);
        var cov = textInOut(textLayer(hook, "we got you covered", "Montserrat-SemiBold", 82, GOLD, 20, 540, 608), 3.65, 5.6);
        lightSweep(cov, 4.2, 5.2, 0, W, 590, 40);
    })();

    // ---------------------------------------------------------- 02 PRODUCT  (5.6 – 9.2s)
    var prod = newComp("02_Product", fComps);
    (function () {
        prod.layers.add(studio);
        var hit = beamLayer(prod, "Shaft Hit", W / 2 - 100, H / 2 - 60, 300, -32, GOLD_HI, 0, 110);
        keys(tr(hit, "ADBE Opacity"), [[5.6, 60], [6.2, 12]]);

        var shadow = prod.layers.addShape();
        shadow.name = "Pack Shadow";
        var sg = shadow.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        sg.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([740, 140]);
        sg.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([0, 0, 0]);
        tr(shadow, "ADBE Position").setValue([560, 1340]);
        blur(shadow).setValue(40);
        keys(tr(shadow, "ADBE Opacity"), [[5.7, 0], [6.2, 80], [8.9, 80], [9.2, 0]]);

        var p = prod.layers.add(pack);
        p.name = "FOCUS Pack";
        var base = 860 / pack.width * 100;  // ≈ 64%
        keys(tr(p, "ADBE Scale"), [[5.6, [base * .75, base * .75, 100]], [6.35, [base * 1.035, base * 1.035, 100]],
            [6.6, [base, base, 100]], [9.2, [base * 1.04, base * 1.04, 100]]]);
        keys(tr(p, "ADBE Rotate Z"), [[5.6, -14], [6.8, -5], [9.2, -3.6]]);
        keys(tr(p, "ADBE Position"), [[5.6, [540, 1250]], [6.5, [540, 1080]], [8.9, [540, 1080]], [9.2, [540, 1040]]]);
        keys(tr(p, "ADBE Opacity"), [[5.6, 0], [5.9, 100], [8.9, 100], [9.2, 0]]);
        lightSweep(p, 6.6, 7.6, -200, pack.width + 200, pack.height / 2, 70);
        var ds = fx(p, "ADBE Drop Shadow");
        ds.property("ADBE Drop Shadow-0002").setValue(60);
        ds.property("ADBE Drop Shadow-0004").setValue(30);
        ds.property("ADBE Drop Shadow-0005").setValue(50);

        textInOut(textLayer(prod, "say hello to", "Montserrat-Light", 58, CREAM, 140, 540, 440), 6.1, 9.2, 25);
        var name = textInOut(textLayer(prod, "Dr B's Focus", "Montserrat-SemiBold", 100, GOLD, 20, 540, 575), 6.35, 9.2, 25);
        lightSweep(name, 7.0, 8.0, 0, W, 540, 40);
        var tabs = textInOut(textLayer(prod, "CHOCOLATE TABS", "Montserrat-Medium", 50, CREAM, 280, 540, 1598), 6.6, 9.2, 25);
        var anim = tabs.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
        var trk = anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Tracking Amount");
        keys(trk, [[6.6, 300], [7.6, 0]]);  // letters settle in
    })();

    // ---------------------------------------------------------- 03 BENEFITS  (9.2 – 13.2s)
    var ben = newComp("03_Benefits", fComps);
    (function () {
        var bg = ben.layers.add(notebook);
        keys(tr(bg, "ADBE Scale"), [[9.2, [100, 100, 100]], [13.2, [107, 107, 100]]], 10);
        darkGradient(ben, "Text Shade", 92, 92);
        textInOut(textLayer(ben, "it boosts your", "Montserrat-Light", 64, CREAM, 100, 540, 352), 9.25, 13.2, 25);
        var items = [["Mental Clarity", 9.6], ["Energy", 10.1], ["Concentration", 10.6]];
        for (var i = 0; i < items.length; i++) {
            var y = 1330 + i * 165, t0 = items[i][1];
            var a = arrowLayer(ben, "Arrow " + (i + 1), 250, y, t0);
            keys(tr(a, "ADBE Opacity"), [[12.9, 100], [13.2, 0]]);
            var w = textLayer(ben, items[i][0], "Montserrat-SemiBold", 74, CREAM, 10, 320, y + 26, ParagraphJustification.LEFT_JUSTIFY);
            var pos = tr(w, "ADBE Position");
            keys(pos, [[t0 + 0.1, [370, y + 26]], [t0 + 0.7, [320, y + 26]]]);
            keys(tr(w, "ADBE Opacity"), [[t0 + 0.1, 0], [t0 + 0.6, 100], [12.9, 100], [13.2, 0]]);
            keys(blur(w), [[t0 + 0.1, 8], [t0 + 0.6, 0], [12.9, 0], [13.2, 12]]);
        }
    })();

    // ---------------------------------------------------------- 04 LOGO  (13.2 – 16.5s)
    var end = newComp("04_Logo", fComps);
    (function () {
        var st = end.layers.add(studio);
        tr(st, "ADBE Opacity").setValue(30);
        var halo = end.layers.addSolid([0.43, 0.28, 0.1], "Warm Halo", W, H, 1);
        var hm = fx(halo, "ADBE Ramp");
        hm.property("ADBE Ramp-0001").setValue([540, 900]);
        hm.property("ADBE Ramp-0002").setValue([0.43, 0.28, 0.1]);
        hm.property("ADBE Ramp-0003").setValue([540 + 700, 900]);
        hm.property("ADBE Ramp-0004").setValue([0, 0, 0]);
        hm.property("ADBE Ramp-0005").setValue(2);
        halo.blendingMode = BlendingMode.ADD;
        keys(tr(halo, "ADBE Opacity"), [[13.2, 30], [14.0, 90]]);

        var lg = end.layers.add(logo);
        lg.name = "Dr.B Logo";
        var s = 760 / logo.width * 100;
        keys(tr(lg, "ADBE Scale"), [[13.2, [s * 1.18, s * 1.18, 100]], [14.2, [s, s, 100]], [16.5, [s * 1.02, s * 1.02, 100]]]);
        tr(lg, "ADBE Position").setValue([540, 860]);
        keys(tr(lg, "ADBE Opacity"), [[13.2, 0], [13.8, 100]]);
        keys(blur(lg), [[13.2, 22], [13.9, 0]]);
        var gl = fx(lg, "ADBE Glo2");
        gl.property("ADBE Glo2-0002").setValue(40);
        gl.property("ADBE Glo2-0003").setValue(60);
        keys(gl.property("ADBE Glo2-0004"), [[13.3, 0], [13.6, 2.2], [14.8, 0.7]]);
        lightSweep(lg, 15.0, 16.0, -200, logo.width + 200, logo.height / 2, 50);

        var line = end.layers.addShape();
        line.name = "Gold Rule";
        var lgp = line.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var path = new Shape(); path.vertices = [[-220, 0], [220, 0]]; path.closed = false;
        lgp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(path);
        var lst = lgp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
        lst.property("ADBE Vector Stroke Color").setValue(GOLD);
        lst.property("ADBE Vector Stroke Width").setValue(3);
        var ltrim = line.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
        keys(ltrim.property("ADBE Vector Trim Start"), [[13.9, 50], [14.5, 0]]);
        keys(ltrim.property("ADBE Vector Trim End"), [[13.9, 50], [14.5, 100]]);
        tr(line, "ADBE Position").setValue([540, 1090]);

        var tag = textLayer(end, "the sharpest you can B", "Montserrat-Light", 60, CREAM, 80, 540, 1212);
        // gold, bold "B" (AE 24.3+ character styling; older versions keep it cream)
        try {
            var stp = tag.property("ADBE Text Properties").property("ADBE Text Document");
            var td = stp.value;
            var r = td.characterRange(21, 22);
            r.fillColor = GOLD; r.font = "Montserrat-Bold"; r.fontSize = 72;
            stp.setValue(td);
        } catch (e) {}
        keys(tr(tag, "ADBE Opacity"), [[14.2, 0], [14.9, 100]]);
        keys(blur(tag), [[14.2, 8], [14.9, 0]]);
        var an = tag.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
        keys(an.property("ADBE Text Animator Properties").addProperty("ADBE Text Tracking Amount"), [[14.2, 350], [15.4, 0]]);
        keys(tr(tag, "ADBE Position"), [[14.2, [540, 1232]], [14.9, [540, 1212]]]);
    })();

    // ---------------------------------------------------------- MAIN
    var main = newComp("DrB_Focus_Reel_9x16", fRoot);
    main.bgColor = [0, 0, 0];
    function seg(comp, tIn, tOut) {
        var l = main.layers.add(comp);
        l.inPoint = tIn; l.outPoint = tOut;
        return l;
    }
    // added bottom → top by AE (each add goes on top), so add in back-to-front order
    seg(hook, 0, 5.6);
    seg(prod, 5.6, 9.2);
    seg(ben, 9.2, 13.2);
    seg(end, 13.2, DUR);

    var d = main.layers.add(dust);
    d.name = "Gold Dust";
    d.blendingMode = BlendingMode.ADD;
    keys(tr(d, "ADBE Opacity"), [[0, 50], [5.5, 50], [5.6, 90]]);
    var dg = fx(d, "ADBE Glo2"); dg.property("ADBE Glo2-0003").setValue(12);

    function flash(at, amt) {
        var fl = main.layers.addSolid([1, 0.88, 0.67], "Flash " + at + "s", W, H, 1);
        fl.blendingMode = BlendingMode.ADD;
        keys(tr(fl, "ADBE Opacity"), [[at - 1 / FPS, 0], [at, amt], [at + 0.35, 0]], 33);
    }
    flash(5.6, 90); flash(13.2, 80);

    vignette(main);

    var grade = main.layers.addSolid([1, 1, 1], "Film Grain", W, H, 1);
    grade.adjustmentLayer = true;
    var noise = fx(grade, "ADBE Noise");
    setByName(noise, "Amount of Noise", 3);
    setByName(noise, "Use Color Noise", 0);

    var fadeIn = main.layers.addSolid([0, 0, 0], "Fade In", W, H, 1);
    keys(tr(fadeIn, "ADBE Opacity"), [[0, 100], [0.35, 0]]);

    var mus = main.layers.add(music);
    mus.name = "Music — drb_focus_score.wav";
    mus.moveToEnd();

    // markers for the edit beats
    var mk = [[0, "HOOK — been losing focus lately?"], [3.3, "that's okay, we got you covered"],
        [5.6, "IMPACT — product reveal"], [9.6, "arrow 1"], [10.1, "arrow 2"], [10.6, "arrow 3"],
        [13.2, "IMPACT — logo"], [14.2, "tagline"]];
    for (var m = 0; m < mk.length; m++) {
        main.markerProperty.setValueAtTime(mk[m][0], new MarkerValue(mk[m][1]));
    }

    // ---------------------------------------------------------- OUTRO
    // Finds the client outro automatically: any video/image with "outro" in its name, in this
    // folder, an "outro" subfolder, or the parent project folders. Otherwise asks for the file.
    function findOutro() {
        var exts = /\.(mp4|mov|avi|mxf|m4v|webm|png|jpg|psd|aep)$/i;
        var dirs = [new Folder(ROOT.fsName + "/assets"), ROOT, new Folder(ROOT.fsName + "/outro"), ROOT.parent, ROOT.parent ? ROOT.parent.parent : null];
        for (var i = 0; i < dirs.length; i++) {
            var d = dirs[i];
            if (!d || !d.exists) { continue; }
            var files = d.getFiles();
            for (var j = 0; j < files.length; j++) {
                if (files[j] instanceof File && /outro/i.test(files[j].name) && exts.test(files[j].name)) { return files[j]; }
            }
        }
        return File.openDialog("Select the OUTRO file (Cancel = no outro)");
    }
    var outroFile = findOutro();
    if (outroFile) {
        var XF = 0.3;                                    // soft cross-dissolve into the outro
        var outroItem = app.project.importFile(new ImportOptions(outroFile));
        outroItem.parentFolder = fAssets;
        var oDur = (outroItem.duration && outroItem.duration > 0) ? outroItem.duration : 3;
        main.duration = DUR - XF + oDur;
        main.workAreaStart = 0;
        main.workAreaDuration = main.duration;
        var ol = main.layers.add(outroItem);
        ol.name = "OUTRO — " + outroFile.name;
        ol.startTime = DUR - XF;
        if (!(outroItem.duration > 0)) { ol.outPoint = main.duration; }
        var ow = outroItem.width, oh = outroItem.height;
        if (ow && oh && (ow !== W || oh !== H)) {
            var fit = Math.max(W / ow, H / oh) * 100;      // fill the 9:16 frame
            ol.property("ADBE Transform Group").property("ADBE Scale").setValue([fit, fit, 100]);
        }
        keys(ol.property("ADBE Transform Group").property("ADBE Opacity"), [[DUR - XF, 0], [DUR, 100]]);
        // the score file already carries a tail that rings out under the outro; just make sure it ends clean
        try {
            mus.outPoint = Math.min(main.duration, mus.startTime + music.duration);
            var lv = mus.property("ADBE Audio Group").property("ADBE Audio Levels");
            keys(lv, [[main.duration - 0.4, [0, 0]], [main.duration, [-48, -48]]]);
        } catch (e) {}
        main.markerProperty.setValueAtTime(DUR - XF, new MarkerValue("OUTRO"));
    }

    // render queue entry (H.264 if the template exists in this AE version)
    var rq = proj.renderQueue.items.add(main);
    var om = rq.outputModule(1);
    try { om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); } catch (e) {}
    om.file = new File(ROOT.fsName + "/render/DrB_Focus_Reel_AE.mp4");

    app.endUndoGroup();
    main.openInViewer();
    proj.save(new File(ROOT.fsName + "/DrB_Focus_Reel.aep"));
    alert("Dr. B Focus reel built ✔\nSaved: " + ROOT.fsName + "/DrB_Focus_Reel.aep");
})();
