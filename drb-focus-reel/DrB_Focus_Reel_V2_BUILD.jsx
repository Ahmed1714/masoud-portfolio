/*  Dr. B — FOCUS Chocolate Tabs  |  Reel OPTION 2 (reference style)  1080x1920 · 30fps · 16s
    Kinetic type pops, vertical whip transitions with real motion blur, 3D pack (extruded layers
    + camera), hand-drawn gold arrows (Trim Paths), chocolate tabs, end card.

    Run:  File > Scripts > Run Script File... > DrB_Focus_Reel_V2_BUILD.jsx
    Needs Montserrat (fonts/): Bold, ExtraBold, Black, ExtraBold Italic. Built-in effects only.
    Saves DrB_Focus_Reel_V2.aep next to this script.
*/
(function () {
    var ROOT = new File($.fileName).parent;
    var W = 1080, H = 1920, FPS = 30, DUR = 16;
    var CUTS = [2.5, 5.0, 8.0, 11.5];
    var GOLD = [0.93, 0.72, 0.35], GOLD_HI = [1, 0.88, 0.59], CREAM = [0.97, 0.95, 0.91];

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
    function easeAll(prop, inf) {
        inf = inf || 80;
        for (var k = 1; k <= prop.numKeys; k++) {
            var dims = 1, vt = prop.propertyValueType;
            if (vt !== PropertyValueType.TwoD_SPATIAL && vt !== PropertyValueType.ThreeD_SPATIAL) {
                var v = prop.keyValue(k);
                dims = (v instanceof Array) ? v.length : 1;
            }
            var e = [];
            for (var d = 0; d < dims; d++) { e.push(new KeyframeEase(0, inf)); }
            try { prop.setTemporalEaseAtKey(k, e, e); } catch (err) {}
        }
    }
    function keys(prop, list, inf) {
        for (var i = 0; i < list.length; i++) { prop.setValueAtTime(list[i][0], list[i][1]); }
        easeAll(prop, inf);
        return prop;
    }
    // ease-in only (accelerating out of frame) / ease-out only (soft landing)
    function accel(prop, k) {
        var dims = 1, vt = prop.propertyValueType;
        if (vt !== PropertyValueType.TwoD_SPATIAL && vt !== PropertyValueType.ThreeD_SPATIAL) {
            var v = prop.keyValue(k); dims = (v instanceof Array) ? v.length : 1;
        }
        var slow = [], lin = [];
        for (var d = 0; d < dims; d++) { slow.push(new KeyframeEase(0, 90)); lin.push(new KeyframeEase(0, 0.1)); }
        return { slow: slow, lin: lin };
    }
    function tr(l, n) { return l.property("ADBE Transform Group").property(n); }
    function fx(l, m) { return l.property("ADBE Effect Parade").addProperty(m); }
    function blur(l) {
        var b = fx(l, "ADBE Gaussian Blur 2");
        b.property("ADBE Gaussian Blur 2-0003").setValue(1);
        return b.property("ADBE Gaussian Blur 2-0001");
    }
    function setByName(e, n, v) { try { e.property(n).setValue(v); } catch (x) {} }
    function centreAnchor(l) {
        var r = l.sourceRectAtTime(0, false);
        tr(l, "ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
        return r;
    }

    // text layer positioned by its visual centre
    function txt(comp, str, font, size, color, x, y, opts) {
        opts = opts || {};
        var l = comp.layers.addText(str);
        var st = l.property("ADBE Text Properties").property("ADBE Text Document");
        var td = st.value;
        td.resetCharStyle();
        td.font = font; td.fontSize = size;
        td.justification = ParagraphJustification.CENTER_JUSTIFY;
        td.tracking = opts.tracking || 0;
        if (opts.outline) {
            td.applyFill = false; td.applyStroke = true;
            td.strokeColor = color; td.strokeWidth = opts.outline;
        } else {
            td.applyFill = true; td.fillColor = color; td.applyStroke = false;
        }
        st.setValue(td);
        l.name = str;
        centreAnchor(l);
        tr(l, "ADBE Position").setValue([x, y]);
        l.motionBlur = true;
        return l;
    }
    // the reference's word pop: overshoot scale + rise + de-blur (+ optional out)
    function pop(l, t0, dur, tOut) {
        dur = dur || 0.45;
        var p = tr(l, "ADBE Position"), base = p.value;
        keys(p, [[t0, [base[0], base[1] + 26]], [t0 + dur, base]]);
        keys(tr(l, "ADBE Scale"), [[t0, [55, 55, 100]], [t0 + dur * 0.6, [106, 106, 100]], [t0 + dur, [100, 100, 100]]]);
        var o = [[t0, 0], [t0 + 0.14, 100]];
        if (tOut) { o.push([tOut, 100], [tOut + 0.2, 0]); }
        keys(tr(l, "ADBE Opacity"), o);
        keys(blur(l), [[t0, 6], [t0 + dur * 0.6, 0]]);
        return l;
    }
    function gold(l, glowAmt) {
        var g = fx(l, "ADBE Glo2");
        g.property("ADBE Glo2-0002").setValue(55);
        g.property("ADBE Glo2-0003").setValue(30);
        g.property("ADBE Glo2-0004").setValue(glowAmt || 0.5);
        return l;
    }
    function radialSolid(comp, name, col, cx, cy, radius, mode, opacity) {
        var s = comp.layers.addSolid([0, 0, 0], name, W, H, 1);
        var r = fx(s, "ADBE Ramp");
        r.property("ADBE Ramp-0001").setValue([cx, cy]);
        r.property("ADBE Ramp-0002").setValue(col);
        r.property("ADBE Ramp-0003").setValue([cx + radius, cy]);
        r.property("ADBE Ramp-0004").setValue([0, 0, 0]);
        r.property("ADBE Ramp-0005").setValue(2);
        s.blendingMode = mode || BlendingMode.ADD;
        tr(s, "ADBE Opacity").setValue(opacity === undefined ? 100 : opacity);
        return s;
    }

    // ---- 3D pack: null controller + 9 shrinking dark slices behind the printed front face
    function pack3D(comp, label, widthPx) {
        var ctrl = comp.layers.addNull();
        ctrl.name = label + " PACK CTRL";
        ctrl.threeDLayer = true;
        var anc = tr(ctrl, "ADBE Anchor Point").value;
        var sc = widthPx / packItem.width * 100;
        var depth = packItem.width * 0.075;
        var K = 9;
        var layers = [];
        for (var k = K; k >= 1; k--) {
            var sl = comp.layers.add(packItem);
            sl.name = label + " pack side " + k;
            sl.threeDLayer = true;
            var fl = fx(sl, "ADBE Fill");
            fl.property("ADBE Fill-0002").setValue(k < 3 ? [0.2, 0.18, 0.16] : [0.085, 0.075, 0.068]);
            sl.parent = ctrl;
            var s = sc * (1 - 0.07 * Math.pow(k / K, 1.5));
            tr(sl, "ADBE Scale").setValue([s, s, s]);
            tr(sl, "ADBE Position").setValue([anc[0], anc[1], depth * (k / K) * sc / 100]);
            sl.shy = true;
            layers.push(sl);
        }
        var front = comp.layers.add(packItem);
        front.name = label + " pack FRONT";
        front.threeDLayer = true;
        front.parent = ctrl;
        tr(front, "ADBE Scale").setValue([sc, sc, sc]);
        tr(front, "ADBE Position").setValue([anc[0], anc[1], 0]);
        // specular sweep follows the pack's Y rotation (turn it → the gloss slides)
        var sw = fx(front, "CC Light Sweep");
        setByName(sw, "Direction", -28);
        setByName(sw, "Width", 90);
        setByName(sw, "Sweep Intensity", 45);
        setByName(sw, "Edge Intensity", 60);
        setByName(sw, "Light Color", [1, 0.93, 0.8]);
        try {
            sw.property("Center").expression =
                "var c = thisComp.layer(\"" + ctrl.name + "\").transform;\n" +
                "var u = 0.5 + c.yRotation/40 - c.xRotation/80;\n" +
                "[thisLayer.width*u, thisLayer.height*0.5];";
        } catch (e) {}
        ctrl.moveToBeginning();
        return { ctrl: ctrl, front: front, sides: layers };
    }
    function packKeys(p, pos, rot, scl) {
        if (pos) { keys(tr(p.ctrl, "ADBE Position"), pos); }
        if (rot) {
            if (rot.x) { keys(tr(p.ctrl, "ADBE Rotate X"), rot.x); }
            if (rot.y) { keys(tr(p.ctrl, "ADBE Rotate Y"), rot.y); }
            if (rot.z) { keys(tr(p.ctrl, "ADBE Rotate Z"), rot.z); }
        }
        if (scl) { keys(tr(p.ctrl, "ADBE Scale"), scl); }
    }
    function floatExpr(prop, amp, speed, phase) {
        prop.expression = "value + " + (prop.value instanceof Array ? "[0, " + amp + "*Math.sin(time*" + speed + "+" + (phase || 0) + ")" + (prop.value.length > 2 ? ", 0]" : "]")
            : amp + "*Math.sin(time*" + speed + "+" + (phase || 0) + ")");
    }
    function camera(comp) {
        var c = comp.layers.addCamera("Camera", [W / 2, H / 2]);
        try { c.property("ADBE Camera Options Group").property("ADBE Camera Zoom").setValue(2200); } catch (e) {}
        tr(c, "ADBE Position").setValue([W / 2, H / 2, -2200]);
        return c;
    }

    function tabLayer(comp, x, y, size, rot, opts) {
        opts = opts || {};
        var l = comp.layers.add(tabItem);
        l.name = "choc tab";
        var s = size / tabItem.width * 100;
        tr(l, "ADBE Scale").setValue([s, s, 100]);
        tr(l, "ADBE Position").setValue([x, y]);
        tr(l, "ADBE Rotate Z").setValue(rot);
        if (opts.blur) { blur(l).setValue(opts.blur); }
        else {
            var ds = fx(l, "ADBE Drop Shadow");
            ds.property("ADBE Drop Shadow-0002").setValue(140);
            ds.property("ADBE Drop Shadow-0003").setValue(160);
            ds.property("ADBE Drop Shadow-0004").setValue(size * 0.1);
            ds.property("ADBE Drop Shadow-0005").setValue(size * 0.12);
        }
        l.motionBlur = true;
        return l;
    }

    // hand-drawn arrow: cubic bezier stroke + 2-stroke head, both drawn on with Trim Paths
    function arrow(comp, name, p0, p1, p2, p3, t0) {
        var s = comp.layers.addShape();
        s.name = name;
        var root = s.property("ADBE Root Vectors Group");
        function strokeGroup(gName, shape, tStart, tEnd, width) {
            var g = root.addProperty("ADBE Vector Group"); g.name = gName;
            var vg = g.property("ADBE Vectors Group");
            vg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(shape);
            var st = vg.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(GOLD_HI);
            st.property("ADBE Vector Stroke Width").setValue(width);
            st.property("ADBE Vector Stroke Line Cap").setValue(2);
            st.property("ADBE Vector Stroke Line Join").setValue(2);
            var trim = vg.addProperty("ADBE Vector Filter - Trim");
            keys(trim.property("ADBE Vector Trim End"), [[tStart, 0], [tEnd, 100]]);
        }
        var body = new Shape();
        body.vertices = [p0, p3];
        body.outTangents = [[p1[0] - p0[0], p1[1] - p0[1]], [0, 0]];
        body.inTangents = [[0, 0], [p2[0] - p3[0], p2[1] - p3[1]]];
        body.closed = false;
        strokeGroup("Line", body, t0, t0 + 0.42, 15);
        var tx = p3[0] - p2[0], ty = p3[1] - p2[1], n = Math.sqrt(tx * tx + ty * ty);
        tx /= n; ty /= n;
        function rotv(a) { var c = Math.cos(a), si = Math.sin(a); return [tx * c - ty * si, tx * si + ty * c]; }
        var a1 = rotv(150 * Math.PI / 180), a2 = rotv(-150 * Math.PI / 180);
        var head = new Shape();
        head.vertices = [[p3[0] + a1[0] * 44, p3[1] + a1[1] * 44], p3, [p3[0] + a2[0] * 44, p3[1] + a2[1] * 44]];
        head.closed = false;
        strokeGroup("Head", head, t0 + 0.38, t0 + 0.55, 15);
        tr(s, "ADBE Position").setValue([0, 0]);
        tr(s, "ADBE Anchor Point").setValue([0, 0]);
        return s;
    }

    // ------------------------------------------------------------ project
    app.beginUndoGroup("Build Dr B Focus Reel V2");
    var proj = app.project;
    var fRoot = proj.items.addFolder("DrB_Focus_Reel_V2");
    var fAssets = proj.items.addFolder("Assets V2"); fAssets.parentFolder = fRoot;
    var fComps = proj.items.addFolder("Scenes V2"); fComps.parentFolder = fRoot;

    var packItem = importFile("assets/focus_pack.png", fAssets);
    var logoItem = importFile("assets/drb_logo_gold.png", fAssets);
    var tabItem = importFile("assets/choc_tab.png", fAssets);
    var music = importFile("audio/drb_focus_score_v2.wav", fAssets);

    function newComp(name, folder) {
        var c = proj.items.addComp(name, W, H, 1, DUR, FPS);
        c.bgColor = [0, 0, 0];
        c.motionBlur = true;
        c.shutterAngle = 270;
        c.motionBlurSamplesPerFrame = 16;
        if (folder) { c.parentFolder = folder; }
        return c;
    }

    // ---------- BG (shared, sits under everything in the main comp)
    var bg = newComp("BG_Chocolate", fComps);
    (function () {
        var b = bg.layers.addSolid([0.2, 0.13, 0.08], "Base", W, H, 1);
        var r = fx(b, "ADBE Ramp");
        r.property("ADBE Ramp-0001").setValue([540, 980]);
        r.property("ADBE Ramp-0002").setValue([0.2, 0.13, 0.08]);
        r.property("ADBE Ramp-0003").setValue([540 + 1150, 980]);
        r.property("ADBE Ramp-0004").setValue([0.035, 0.024, 0.016]);
        r.property("ADBE Ramp-0005").setValue(2);
        var n = fx(b, "ADBE Noise");
        setByName(n, "Amount of Noise", 4);
        setByName(n, "Use Color Noise", 0);
    })();

    // ---------- gold dust
    var dust = newComp("FX_GoldDust_V2", fComps);
    (function () {
        for (var i = 1; i <= 40; i++) {
            var s = dust.layers.addShape();
            s.name = "mote " + i;
            var g = s.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            var sz = 3 + Math.random() * 5;
            g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([sz, sz]);
            g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(GOLD_HI);
            tr(s, "ADBE Position").expression =
                "seedRandom(index, true);\nvar x0 = random(0, thisComp.width), y0 = random(0, thisComp.height), v = random(8, 28), ph = random(0, 6.28);\n" +
                "[x0 + 16*Math.sin(time*0.7 + ph), ((y0 - v*time) % thisComp.height + thisComp.height) % thisComp.height];";
            tr(s, "ADBE Opacity").expression = "seedRandom(index, true); var ph = random(0, 6.28);\n50 + 50*Math.sin(time*2.4 + ph*3);";
            blur(s).setValue(1.5);
        }
    })();

    // ================================================== S1 HOOK  0 – 2.5
    var s1 = newComp("S1_Hook", fComps);
    (function () {
        radialSolid(s1, "Glow under pack", [0.59, 0.38, 0.14], 540, 1500, 700, BlendingMode.ADD, 0);
        keys(tr(s1.layer(1), "ADBE Opacity"), [[1.1, 25], [1.8, 100]]);
        var orb = radialSolid(s1, "Warm orb", [1, 0.77, 0.43], 900, 250, 150, BlendingMode.ADD, 100);
        var orb2 = radialSolid(s1, "Warm orb halo", [0.75, 0.47, 0.2], 900, 250, 380, BlendingMode.ADD, 60);
        keys(tr(orb, "ADBE Position"), [[1.0, [540, 960]], [1.5, [960, 960]]]);
        keys(tr(orb2, "ADBE Position"), [[1.0, [540, 960]], [1.5, [960, 960]]]);

        var tA = tabLayer(s1, 120, 300, 300, 18, { blur: 9 });
        keys(tr(tA, "ADBE Position"), [[0, [120, 300]], [1.0, [120, 310]], [1.4, [-300, 314]]]);
        keys(tr(tA, "ADBE Rotate Z"), [[0, 18], [1.4, 26]]);
        var tB = tabLayer(s1, 930, 1500, 340, -14, { blur: 12 });
        keys(tr(tB, "ADBE Position"), [[0, [930, 1500]], [1.0, [930, 1486]], [1.4, [1350, 1480]]]);
        keys(tr(tB, "ADBE Rotate Z"), [[0, -14], [1.4, -21]]);

        // phase A — centred question, then whips up out of frame (real motion blur)
        var a1 = pop(txt(s1, "been", "Montserrat-Bold", 74, CREAM, 400, 840), 0.08);
        var a2 = pop(txt(s1, "losing", "Montserrat-Bold", 74, CREAM, 640, 840), 0.22);
        var a3 = gold(pop(txt(s1, "FOCUS", "Montserrat-Black", 190, GOLD, 540, 990, { tracking: 20 }), 0.45, 0.5), 0.6);
        var grp = [a1, a2, a3];
        for (var i = 0; i < grp.length; i++) {
            var p = tr(grp[i], "ADBE Position"), v = p.valueAtTime(1.0, true);
            p.setValueAtTime(1.0, v);
            p.setValueAtTime(1.25, [v[0], v[1] - 900]);
            var o = tr(grp[i], "ADBE Opacity");
            o.setValueAtTime(1.2, 100); o.setValueAtTime(1.25, 0);
        }
        // phase B — question parks on top, lands from below
        var b1 = txt(s1, "been losing", "Montserrat-Bold", 58, CREAM, 540, 205);
        var b2 = gold(txt(s1, "FOCUS", "Montserrat-Black", 132, GOLD, 540, 318, { tracking: 20 }), 0.5);
        var bl = [b1, b2];
        for (var j = 0; j < bl.length; j++) {
            var bp = tr(bl[j], "ADBE Position"), bv = bp.value;
            keys(bp, [[1.25, [bv[0], bv[1] + 300]], [1.6, bv]]);
            keys(tr(bl[j], "ADBE Opacity"), [[1.24, 0], [1.25, 100]]);
        }
        pop(txt(s1, "lately?", "Montserrat-ExtraBold", 92, CREAM, 540, 450), 1.5);

        camera(s1);
        var pk = pack3D(s1, "S1", 1240);
        packKeys(pk, [[1.05, [600, 2530, 0]], [1.9, [560, 1430, 0]]],
            { x: [[1.05, 10]], y: [[1.05, -16], [2.45, -10]], z: [[1.05, -3], [1.9, -7], [2.3, -7], [2.5, -35]] },
            [[2.3, [100, 100, 100]], [2.5, [140, 140, 140]]]);
        floatExpr(tr(pk.ctrl, "ADBE Position"), 10, 2);
    })();

    // ================================================== S2 COVERED  2.5 – 5.0
    var s2 = newComp("S2_Covered", fComps);
    (function () {
        radialSolid(s2, "Glow", [0.59, 0.38, 0.14], 540, 1500, 700, BlendingMode.ADD, 100);
        var fall = tabLayer(s2, 700, 380, 120, 0);
        keys(tr(fall, "ADBE Position"), [[2.9, [700, 380]], [5.0, [740, 1480]]], 20);
        keys(tr(fall, "ADBE Rotate Z"), [[2.9, 0], [5.0, 400]], 20);
        keys(tr(fall, "ADBE Opacity"), [[2.9, 0], [3.0, 100]]);

        pop(txt(s2, "that's okay,", "Montserrat-Bold", 64, CREAM, 540, 215), 2.55);
        gold(pop(txt(s2, "we got you", "Montserrat-ExtraBold", 86, GOLD, 540, 310), 2.72), 0.4);
        var order = [3, 2, 4, 1, 5, 0, 6];
        for (var r = 0; r < order.length; r++) {
            var i = order[r], y = 520 + i * 170, t0 = 2.85 + r * 0.06;
            var row;
            if (i === 3) {
                row = gold(pop(txt(s2, "COVERED", "Montserrat-Black", 178, GOLD, 540, y, { tracking: 10 }), t0, 0.5), 0.6);
            } else {
                row = txt(s2, "COVERED", "Montserrat-Black", 178, CREAM, 540, y, { tracking: 10, outline: 3 });
                keys(tr(row, "ADBE Opacity"), [[t0, 0], [t0 + 0.3, 42]]);
                keys(blur(row), [[t0, 8], [t0 + 0.35, 0]]);
            }
            // gentle opposite drift per row (parallax)
            tr(row, "ADBE Position").expression =
                "value + [" + (i % 2 ? 1 : -1) + " * linear(time, 2.85, 5.0, -24, 24), " +
                (i === 3 ? "0" : "linear(time, " + t0 + ", " + (t0 + 0.4) + ", 30, 0)") + "];";
        }
        camera(s2);
        var pk = pack3D(s2, "S2", 640);
        packKeys(pk, [[2.5, [540, 2100, 0]], [3.0, [540, 1600, 0]]], { x: [[2.5, 8]], z: [[2.5, -4]] });
        tr(pk.ctrl, "ADBE Rotate Y").expression = "14*Math.sin(time*1.6)";
        var l1 = tabLayer(s2, 230, 1760, 230, -18);
        keys(tr(l1, "ADBE Position"), [[2.5, [30, 1760]], [3.0, [230, 1760]]]);
        tr(l1, "ADBE Rotate Z").expression = "value + time*4";
        var l2 = tabLayer(s2, 860, 1730, 250, 14);
        keys(tr(l2, "ADBE Position"), [[2.5, [1060, 1730]], [3.0, [860, 1730]]]);
        tr(l2, "ADBE Rotate Z").expression = "value - time*4";
    })();

    // ================================================== S3 SAY HELLO  5.0 – 8.0
    var s3 = newComp("S3_SayHello", fComps);
    (function () {
        radialSolid(s3, "Glow", [0.59, 0.38, 0.14], 540, 1150, 720, BlendingMode.ADD, 100);
        pop(txt(s3, "say hello to", "Montserrat-Bold", 56, CREAM, 540, 205), 5.05);
        gold(pop(txt(s3, "Dr B's Focus", "Montserrat-Black", 108, GOLD, 540, 310), 5.2), 0.5);
        pop(txt(s3, "Chocolate Tabs", "Montserrat-ExtraBold", 92, CREAM, 540, 425), 5.35);

        camera(s3);
        var pk = pack3D(s3, "S3", 720);
        packKeys(pk, [[5.0, [540, 1120, 0]], [7.75, [540, 1120, 0]], [8.0, [540, 1360, 0]]],
            { z: [[7.75, 0], [8.0, -90]] },
            [[5.0, [75, 75, 75]], [5.7, [100, 100, 100]], [7.75, [100, 100, 100]], [8.0, [160, 160, 160]]]);
        tr(pk.ctrl, "ADBE Rotate Y").expression = "var intro = linear(time, 5.0, 5.9, 45, 0);\nintro + 16*Math.sin((time-5.6)*1.4)*clamp(time-5.6, 0, 1);";
        tr(pk.ctrl, "ADBE Rotate X").expression = "6*Math.sin(time*1.3)";
        floatExpr(tr(pk.ctrl, "ADBE Position"), 6, 1.8);

        var t1 = tabLayer(s3, 780, 1475, 160, 16); floatExpr(tr(t1, "ADBE Position"), 4, 2.4);
        var t2 = tabLayer(s3, 660, 1510, 125, -22); floatExpr(tr(t2, "ADBE Position"), 4, 2.0, 1);

        var doodles = [["SHARP!", 200, 690, 9, 5.55, GOLD], ["WOW!", 885, 720, -9, 5.7, CREAM], ["NEW!", 160, 1150, 7, 5.85, GOLD],
            ["YES!", 230, 1590, -7, 6.0, CREAM], ["LET'S GO!", 840, 1600, 8, 6.15, GOLD]];
        for (var i = 0; i < doodles.length; i++) {
            var d = doodles[i];
            var l = pop(txt(s3, d[0], "Montserrat-ExtraBoldItalic", 64, d[5], d[1], d[2]), d[4], 0.4);
            tr(l, "ADBE Rotate Z").setValue(d[3]);
            // hand-lettered "boil": 8fps jitter
            tr(l, "ADBE Rotate Z").expression = "posterizeTime(8);\nvalue + 1.2*Math.sin(time*13.6 + index*2);";
        }
    })();

    // ================================================== S4 BENEFITS  8.0 – 11.5
    var s4 = newComp("S4_Benefits", fComps);
    (function () {
        radialSolid(s4, "Glow", [0.59, 0.38, 0.14], 620, 1000, 680, BlendingMode.ADD, 100);
        pop(txt(s4, "it boosts your", "Montserrat-ExtraBold", 74, CREAM, 540, 235), 8.1);
        camera(s4);
        var pk = pack3D(s4, "S4", 780);
        packKeys(pk, [[8.0, [420, 990, 0]], [8.55, [150, 990, 0]]], { x: [[8.0, 4]], z: [[8.0, -125], [8.55, -78]] },
            [[8.0, [145, 145, 145]], [8.55, [100, 100, 100]]]);
        tr(pk.ctrl, "ADBE Rotate Y").expression = "10 + 4*Math.sin(time*1.2)";
        floatExpr(tr(pk.ctrl, "ADBE Position"), 5, 1.7);

        var mouth = [395, 975];
        var spill = [[560, 905, 128, 30], [720, 850, 118, -20], [885, 935, 132, 12], [640, 1060, 140, -35],
            [805, 1085, 124, 25], [965, 1010, 112, -8], [720, 1220, 120, 40]];
        for (var i = 0; i < spill.length; i++) {
            var s = spill[i], t0 = 8.05 + i * 0.04;
            var tl = tabLayer(s4, s[0], s[1], s[2], s[3]);
            var mid = [(mouth[0] + s[0]) / 2, (mouth[1] + s[1]) / 2 - 120 * (0.4 + 0.2 * (i % 3))];
            keys(tr(tl, "ADBE Position"), [[t0, mouth], [t0 + 0.32, mid], [t0 + 0.75, [s[0], s[1]]]]);
            keys(tr(tl, "ADBE Rotate Z"), [[t0, s[3] + 220], [t0 + 0.75, s[3]]]);
            var sc = tr(tl, "ADBE Scale").value;
            keys(tr(tl, "ADBE Scale"), [[t0, [sc[0] * 0.6, sc[1] * 0.6, 100]], [t0 + 0.75, sc]]);
            keys(tr(tl, "ADBE Opacity"), [[t0, 0], [t0 + 0.05, 100]]);
            tr(tl, "ADBE Position").expression = "value + (time > " + (t0 + 0.75) + " ? [0, 5*Math.sin(time*2 + " + i + ")] : [0, 0]);";
        }
        var labels = [["Mental Clarity", 600, 560, 8.85, [560, 625], [470, 700], [470, 800], [585, 835]],
            ["Energy", 300, 1450, 9.35, [290, 1390], [270, 1300], [420, 1170], [565, 1130]],
            ["Concentration", 790, 1545, 9.85, [850, 1485], [930, 1400], [900, 1270], [790, 1180]]];
        for (var j = 0; j < labels.length; j++) {
            var L = labels[j];
            pop(txt(s4, L[0], "Montserrat-ExtraBold", 64, CREAM, L[1], L[2]), L[3]);
            arrow(s4, "Arrow " + L[0], L[4], L[5], L[6], L[7], L[3] + 0.15);
        }
    })();

    // ================================================== S5 END CARD  11.5 – 16
    var s5 = newComp("S5_EndCard", fComps);
    (function () {
        var g = radialSolid(s5, "Glow", [0.59, 0.38, 0.14], 540, 1280, 720, BlendingMode.ADD, 60);
        keys(tr(g, "ADBE Opacity"), [[11.5, 45], [12.5, 100]]);
        var lg = s5.layers.add(logoItem);
        lg.name = "Dr.B Logo";
        var ls = 680 / logoItem.width * 100;
        keys(tr(lg, "ADBE Scale"), [[11.6, [ls * 0.86, ls * 0.86, 100]], [12.4, [ls, ls, 100]], [16, [ls * 1.015, ls * 1.015, 100]]]);
        keys(tr(lg, "ADBE Position"), [[11.6, [540, 370]], [12.3, [540, 330]]]);
        keys(tr(lg, "ADBE Opacity"), [[11.6, 0], [12.0, 100]]);
        keys(blur(lg), [[11.6, 14], [12.2, 0]]);
        var lgl = fx(lg, "ADBE Glo2");
        lgl.property("ADBE Glo2-0002").setValue(40);
        lgl.property("ADBE Glo2-0003").setValue(50);
        keys(lgl.property("ADBE Glo2-0004"), [[11.8, 0], [12.1, 1.8], [13.3, 0.6]]);

        // "the sharpest you can B" — words laid out from measured widths, popped in order
        var words = [["the", 12.05], ["sharpest", 12.18], ["you", 12.31], ["can", 12.44]];
        var ls2 = [], total = 0, gap = 18;
        for (var i = 0; i < words.length; i++) {
            var l = txt(s5, words[i][0], "Montserrat-Bold", 58, CREAM, 0, 560);
            var w = l.sourceRectAtTime(0, false).width;
            ls2.push([l, w]); total += w + gap;
        }
        var bL = txt(s5, "B", "Montserrat-Black", 84, GOLD, 0, 552);
        var bw = bL.sourceRectAtTime(0, false).width;
        total += bw;
        var x = (W - total) / 2;
        for (var k = 0; k < ls2.length; k++) {
            tr(ls2[k][0], "ADBE Position").setValue([x + ls2[k][1] / 2, 560]);
            pop(ls2[k][0], words[k][1]);
            x += ls2[k][1] + gap;
        }
        tr(bL, "ADBE Position").setValue([x + bw / 2, 552]);
        gold(pop(bL, 12.65, 0.55), 0.8);

        camera(s5);
        var pk = pack3D(s5, "S5", 760);
        packKeys(pk, [[11.5, [540, 1910, 0]], [12.2, [540, 1210, 0]]], { x: [[11.5, 5]], z: [[11.5, -2]] });
        tr(pk.ctrl, "ADBE Rotate Y").expression = "linear(time, 11.5, 12.4, -35, 0) + 9*Math.sin((time-12.4)*1.2)*clamp(time-12.4, 0, 1);";
        floatExpr(tr(pk.ctrl, "ADBE Position"), 8, 1.6);
        var pile = [[230, 1640, 200, -18], [850, 1625, 210, 16], [410, 1715, 180, 8], [680, 1720, 190, -10], [540, 1800, 170, 24]];
        for (var p = 0; p < pile.length; p++) {
            var q = pile[p], side = q[0] < 540 ? -1 : 1, t0 = 11.6 + p * 0.05;
            var tl = tabLayer(s5, q[0], q[1], q[2], q[3]);
            keys(tr(tl, "ADBE Position"), [[t0, [q[0] + side * 400, q[1]]], [t0 + 0.7, [q[0], q[1]]]]);
            tr(tl, "ADBE Position").expression = "value + [0, 3*Math.sin(time*2 + " + p + ")];";
        }
        // gold streak (the reference's swoosh line)
        var sw = s5.layers.addShape();
        sw.name = "Gold Streak";
        var sg = sw.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var path = new Shape();
        path.vertices = [[1250, 640], [-160, 830]];
        path.outTangents = [[-390, 60], [0, 0]];
        path.inTangents = [[0, 0], [580, -70]];
        path.closed = false;
        sg.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(path);
        var st = sg.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(GOLD_HI);
        st.property("ADBE Vector Stroke Width").setValue(8);
        st.property("ADBE Vector Stroke Line Cap").setValue(2);
        var trim = sg.property("ADBE Vectors Group").addProperty("ADBE Vector Filter - Trim");
        keys(trim.property("ADBE Vector Trim End"), [[12.25, 0], [12.8, 100]]);
        keys(trim.property("ADBE Vector Trim Start"), [[12.44, 0], [13.0, 100]]);
        tr(sw, "ADBE Anchor Point").setValue([0, 0]);
        tr(sw, "ADBE Position").setValue([0, 0]);
        gold(sw, 1.0);
    })();

    // ================================================== MAIN
    var main = newComp("DrB_Focus_Reel_V2_9x16", fRoot);
    main.layers.add(bg);
    var scenes = [[s1, 0, 2.5], [s2, 2.5, 5.0], [s3, 5.0, 8.0], [s4, 8.0, 11.5], [s5, 11.5, DUR]];
    for (var i = 0; i < scenes.length; i++) {
        var sc = scenes[i];
        var l = main.layers.add(sc[0]);
        l.inPoint = sc[1]; l.outPoint = sc[2];
        l.motionBlur = true;
        var pos = tr(l, "ADBE Position"), db = fx(l, "ADBE Motion Blur"); // Directional Blur
        db.property("ADBE Motion Blur-0001").setValue(0);                    // vertical
        var dl = db.property("ADBE Motion Blur-0002");
        // whip in (lands from below, soft ease-out)
        if (sc[1] > 0) {
            pos.setValueAtTime(sc[1], [540, 960 + 520]);
            pos.setValueAtTime(sc[1] + 0.3, [540, 960]);
            dl.setValueAtTime(sc[1], 120); dl.setValueAtTime(sc[1] + 0.3, 0);
        }
        // whip out (accelerates up)
        if (sc[2] < DUR) {
            pos.setValueAtTime(sc[2] - 0.2, [540, 960]);
            pos.setValueAtTime(sc[2], [540, 960 - 520]);
            dl.setValueAtTime(sc[2] - 0.2, 0); dl.setValueAtTime(sc[2], 120);
        }
        // curve the whips: fast at the cut, slow at rest
        var props = [pos, dl];
        for (var pi = 0; pi < props.length; pi++) {
            var pr = props[pi];
            for (var k = 1; k <= pr.numKeys; k++) {
                var tk = pr.keyTime(k), atCut = false;
                for (var c = 0; c < CUTS.length; c++) { if (Math.abs(tk - CUTS[c]) < 0.001) { atCut = true; } }
                var e = accel(pr, k);
                try { pr.setTemporalEaseAtKey(k, atCut ? e.lin : e.slow, atCut ? e.lin : e.slow); } catch (err) {}
            }
        }
    }
    var d = main.layers.add(dust);
    d.name = "Gold Dust"; d.blendingMode = BlendingMode.ADD;
    tr(d, "ADBE Opacity").setValue(75);
    fx(d, "ADBE Glo2").property("ADBE Glo2-0003").setValue(12);

    var v = main.layers.addSolid([1, 1, 1], "Vignette", W, H, 1);
    var vr = fx(v, "ADBE Ramp");
    vr.property("ADBE Ramp-0001").setValue([W / 2, H / 2]);
    vr.property("ADBE Ramp-0002").setValue([1, 1, 1]);
    vr.property("ADBE Ramp-0003").setValue([W / 2 + 1150, H / 2]);
    vr.property("ADBE Ramp-0004").setValue([0, 0, 0]);
    vr.property("ADBE Ramp-0005").setValue(2);
    v.blendingMode = BlendingMode.MULTIPLY;
    tr(v, "ADBE Opacity").setValue(60);

    var grain = main.layers.addSolid([1, 1, 1], "Film Grain", W, H, 1);
    grain.adjustmentLayer = true;
    var gn = fx(grain, "ADBE Noise");
    setByName(gn, "Amount of Noise", 3);
    setByName(gn, "Use Color Noise", 0);

    var fade = main.layers.addSolid([0, 0, 0], "Fade In", W, H, 1);
    keys(tr(fade, "ADBE Opacity"), [[0, 100], [0.25, 0]]);

    var mus = main.layers.add(music);
    mus.name = "Music — drb_focus_score_v2.wav";
    mus.moveToEnd();

    var mk = [[0, "HOOK"], [2.5, "WHIP → that's okay / COVERED"], [5.0, "WHIP → say hello"], [8.0, "SPIN → benefits"],
        [8.85, "arrow 1"], [9.35, "arrow 2"], [9.85, "arrow 3"], [11.5, "WHIP → end card"]];
    for (var m = 0; m < mk.length; m++) { main.markerProperty.setValueAtTime(mk[m][0], new MarkerValue(mk[m][1])); }

    var rq = proj.renderQueue.items.add(main);
    var om = rq.outputModule(1);
    try { om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); } catch (e) {}
    om.file = new File(ROOT.fsName + "/render/DrB_Focus_Reel_V2_AE.mp4");

    app.endUndoGroup();
    main.openInViewer();
    proj.save(new File(ROOT.fsName + "/DrB_Focus_Reel_V2.aep"));
    alert("Dr. B Focus reel — Option 2 built ✔\nSaved: " + ROOT.fsName + "/DrB_Focus_Reel_V2.aep");
})();
