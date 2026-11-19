/*
 * PUVANA - Logo Outro (White Background)
 * ---------------------------------------------------------------
 * After Effects ExtendScript - builds the full outro project.
 *
 * How to run:
 *   After Effects > File > Scripts > Run Script File...  > PUVANA_Outro.jsx
 *   (put "puvana_logo.png" next to this script, or pick the logo when asked)
 *
 * Animation (6 sec @ 30fps, 1920x1080):
 *   0.00  A teal water drop falls into frame
 *   0.55  Impact: water ripples + splash droplets
 *   0.60  Gold outline draws the badge shape from the top
 *   1.10  Logo pops in with 3D flip + elastic overshoot
 *   1.25  Gold sparkles burst around the badge
 *   2.20  Light sweep (shine) across the logo
 *   2.40  Tagline + gold lines reveal
 *   1.8 -> end  Slow cinematic push-in
 * ---------------------------------------------------------------
 */

(function puvanaOutro() {

    // ================= CONFIG (edit freely) =================
    var CFG = {
        compName   : "PUVANA_Outro",
        width      : 1920,
        height     : 1080,
        fps        : 30,
        duration   : 6,            // seconds
        logoWidth  : 640,          // logo display width in px (use a hi-res / vector logo for bigger)
        tagline    : "PURE  •  NATURAL  •  FRESH",   // set to "" to remove the tagline
        font       : "Arial-BoldMT",
        bgVignette : true,         // very soft grey edges on the white background
        fadeOut    : false,        // fade to white at the end
        logoFileName : "puvana_logo.png"
    };

    // Brand colours (picked from the logo)
    var COL = {
        white     : hex("FFFFFF"),
        bgEdge    : hex("EEF3F5"),
        teal      : hex("16A0B8"),
        tealDark  : hex("0F4A63"),
        gold      : hex("C9A052"),
        goldLight : hex("E6C987"),
        shadow    : hex("0B2E3D")
    };

    // ================= HELPERS =================
    function hex(h) {
        return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    }

    var seed = 1714;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    function rrange(a, b) { return a + (b - a) * rnd(); }

    function dimsOf(prop) {
        var t = prop.propertyValueType;
        if (t === PropertyValueType.TwoD) return 2;
        if (t === PropertyValueType.ThreeD) return 3;
        return 1;
    }

    // keys: [[time, value, kind], ...]   kind: "e" ease, "s" strong ease, "l" linear, "ei" ease-in only, "eo" ease-out only
    function anim(prop, keys) {
        var i, k;
        for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
        var n = dimsOf(prop);
        for (i = 0; i < keys.length; i++) {
            k = keys[i];
            var kind = k[2] || "e";
            var idx = prop.nearestKeyIndex(k[0]);
            var inInf = 70, outInf = 70;
            if (kind === "s") { inInf = 92; outInf = 92; }
            if (kind === "ei") { inInf = 88; }
            if (kind === "eo") { outInf = 88; }
            var inArr = [], outArr = [], d;
            for (d = 0; d < n; d++) {
                inArr.push(new KeyframeEase(0, inInf));
                outArr.push(new KeyframeEase(0, outInf));
            }
            try { prop.setTemporalEaseAtKey(idx, inArr, outArr); } catch (e) {}
            var B = KeyframeInterpolationType.BEZIER, L = KeyframeInterpolationType.LINEAR;
            if (kind === "l") prop.setInterpolationTypeAtKey(idx, L, L);
            else if (kind === "ei") prop.setInterpolationTypeAtKey(idx, B, L);
            else if (kind === "eo") prop.setInterpolationTypeAtKey(idx, L, B);
        }
    }

    function tr(layer, name) { return layer.property("ADBE Transform Group").property(name); }
    function fx(layer, matchName) { return layer.property("ADBE Effect Parade").addProperty(matchName); }

    // ---- shape layer helpers (always re-fetch: AE invalidates refs after addProperty) ----
    function newShape(comp, name, pos) {
        var l = comp.layers.addShape();
        l.name = name;
        tr(l, "ADBE Position").setValue(pos);
        return l;
    }
    function addGroup(layer, name) {
        var g = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.name = name;
        return layer.property("ADBE Root Vectors Group").numProperties;
    }
    function grp(layer, gi) { return layer.property("ADBE Root Vectors Group").property(gi); }
    function vc(layer, gi) { return grp(layer, gi).property("ADBE Vectors Group"); }
    function gtr(layer, gi, name) { return grp(layer, gi).property("ADBE Vector Transform Group").property(name); }

    function addEllipse(layer, gi, size) {
        vc(layer, gi).addProperty("ADBE Vector Shape - Ellipse");
        vc(layer, gi).property("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue(size);
    }
    function addRect(layer, gi, size) {
        vc(layer, gi).addProperty("ADBE Vector Shape - Rect");
        vc(layer, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue(size);
    }
    function addStar(layer, gi, outer, inner) {
        vc(layer, gi).addProperty("ADBE Vector Shape - Star");
        var s = vc(layer, gi).property("ADBE Vector Shape - Star");
        s.property("ADBE Vector Star Type").setValue(1);
        s.property("ADBE Vector Star Points").setValue(4);
        s = vc(layer, gi).property("ADBE Vector Shape - Star");
        s.property("ADBE Vector Star Outer Radius").setValue(outer);
        s = vc(layer, gi).property("ADBE Vector Shape - Star");
        s.property("ADBE Vector Star Inner Radius").setValue(inner);
    }
    function addPath(layer, gi, verts, inT, outT, closed) {
        vc(layer, gi).addProperty("ADBE Vector Shape - Group");
        var sh = new Shape();
        sh.vertices = verts;
        sh.inTangents = inT;
        sh.outTangents = outT;
        sh.closed = closed;
        vc(layer, gi).property("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
    }
    function addFill(layer, gi, color, opacity) {
        vc(layer, gi).addProperty("ADBE Vector Graphic - Fill");
        var f = vc(layer, gi).property("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(color);
        if (opacity !== undefined) {
            f = vc(layer, gi).property("ADBE Vector Graphic - Fill");
            f.property("ADBE Vector Fill Opacity").setValue(opacity);
        }
    }
    function addStroke(layer, gi, color, width) {
        vc(layer, gi).addProperty("ADBE Vector Graphic - Stroke");
        var s = vc(layer, gi).property("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(color);
        s = vc(layer, gi).property("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Width").setValue(width);
        s = vc(layer, gi).property("ADBE Vector Graphic - Stroke");
        try { s.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}   // round cap
        return function () { return vc(layer, gi).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width"); };
    }
    function addTrim(layer, gi) {
        vc(layer, gi).addProperty("ADBE Vector Filter - Trim");
        return function (name) { return vc(layer, gi).property("ADBE Vector Filter - Trim").property(name); };
    }
    function addRoundCorners(layer, gi, r) {
        try {
            vc(layer, gi).addProperty("ADBE Vector Filter - RC");
            vc(layer, gi).property("ADBE Vector Filter - RC").property("ADBE Vector RoundCorner Radius").setValue(r);
        } catch (e) {}
    }

    function findLogoFile() {
        var here = File($.fileName).parent;
        var names = [CFG.logoFileName, "logo.png", "PUVANA.png", "puvana.png"];
        for (var i = 0; i < names.length; i++) {
            var f = new File(here.fsName + "/" + names[i]);
            if (f.exists) return f;
        }
        var filter = ($.os.indexOf("Windows") !== -1) ? "Images:*.png;*.psd;*.ai;*.jpg;*.tif" : undefined;
        return File.openDialog("Select the PUVANA logo (PNG with transparency / AI / PSD)", filter);
    }

    // ================= BUILD =================
    var logoFile = findLogoFile();
    if (!logoFile) { alert("No logo selected - script cancelled."); return; }

    app.beginUndoGroup("PUVANA Outro");
    try {
        var W = CFG.width, H = CFG.height, DUR = CFG.duration;
        var proj = app.project || app.newProject();

        var folder = proj.items.addFolder("PUVANA Outro");
        var footage = proj.importFile(new ImportOptions(logoFile));
        footage.parentFolder = folder;

        var comp = proj.items.addComp(CFG.compName, W, H, 1, DUR, CFG.fps);
        comp.parentFolder = folder;
        comp.bgColor = COL.white;
        comp.motionBlur = true;
        try { comp.shutterAngle = 180; } catch (e) {}

        var S = CFG.logoWidth / footage.width * 100;            // base logo scale %
        var LW = footage.width * S / 100, LH = footage.height * S / 100;
        var hasTag = CFG.tagline && CFG.tagline.length > 0;
        var CX = W / 2, CY = H / 2 - (hasTag ? 45 : 0);           // logo centre
        var T_IMPACT = 0.55, T_LOGO = 1.10;

        // ---------- 1. Background ----------
        var bg = comp.layers.addSolid(COL.white, "BG White", W, H, 1, DUR);
        if (CFG.bgVignette) {
            var ramp = fx(bg, "ADBE Ramp");
            ramp.property("ADBE Ramp-0001").setValue([CX, CY]);
            ramp.property("ADBE Ramp-0002").setValue(COL.white);
            ramp.property("ADBE Ramp-0003").setValue([0, 0]);
            ramp.property("ADBE Ramp-0004").setValue(COL.bgEdge);
            ramp.property("ADBE Ramp-0005").setValue(2);       // radial
        }
        bg.locked = true;

        // ---------- 2. Water ripples ----------
        var ripSizes = [700, 1000, 1350];
        for (var r = 0; r < 3; r++) {
            var rl = newShape(comp, "Ripple " + (r + 1), [CX, CY]);
            var rg = addGroup(rl, "Ring");
            addEllipse(rl, rg, [10, 10]);
            var rw = addStroke(rl, rg, r === 1 ? COL.gold : COL.teal, 8 - r * 2);
            var t0 = T_IMPACT + r * 0.12;
            anim(vc(rl, rg).property("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size"),
                [[t0, [10, 10], "eo"], [t0 + 1.4, [ripSizes[r], ripSizes[r]], "ei"]]);
            anim(rw(), [[t0, 8 - r * 2, "eo"], [t0 + 1.4, 0.5, "ei"]]);
            anim(tr(rl, "ADBE Opacity"), [[t0, 0, "l"], [t0 + 0.08, 70, "l"], [t0 + 1.4, 0, "ei"]]);
            rl.inPoint = t0; rl.outPoint = t0 + 1.5;
            rl.motionBlur = true;
        }

        // ---------- 3. Splash droplets ----------
        for (var d = 0; d < 10; d++) {
            var ang = (d / 10) * Math.PI * 2 + rrange(-0.2, 0.2);
            var dist = rrange(140, 340);
            var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.6;
            var dl = newShape(comp, "Splash " + (d + 1), [CX, CY]);
            var dg = addGroup(dl, "Dot");
            var ds = rrange(10, 20);
            addEllipse(dl, dg, [ds, ds]);
            addFill(dl, dg, d % 3 === 0 ? COL.gold : COL.teal);
            var st = T_IMPACT + rrange(0, 0.06);
            anim(tr(dl, "ADBE Position"), [
                [st, [CX, CY], "eo"],
                [st + 0.28, [CX + dx * 0.65, CY + dy * 0.65 - rrange(60, 130)], "e"],
                [st + 0.6, [CX + dx, CY + dy + 40], "ei"]
            ]);
            anim(tr(dl, "ADBE Scale"), [[st, [0, 0], "eo"], [st + 0.1, [100, 100], "e"], [st + 0.6, [0, 0], "ei"]]);
            dl.inPoint = st; dl.outPoint = st + 0.65;
            dl.motionBlur = true;
        }

        // ---------- 4. Falling drop ----------
        var drop = newShape(comp, "Water Drop", [CX, -120]);
        var dg1 = addGroup(drop, "Drop");
        addPath(drop, dg1,
            [[0, -55], [28, 12], [0, 40], [-28, 12]],
            [[0, 0], [0, -24], [16, 0], [0, 16]],
            [[0, 0], [0, 16], [-16, 0], [0, -24]], true);
        addFill(drop, dg1, COL.teal);
        var dg2 = addGroup(drop, "Highlight");
        addEllipse(drop, dg2, [9, 16]);
        addFill(drop, dg2, COL.white, 80);
        gtr(drop, dg2, "ADBE Vector Position").setValue([-10, 8]);
        anim(tr(drop, "ADBE Position"), [[0, [CX, -120], "eo"], [T_IMPACT, [CX, CY], "l"]]);
        anim(tr(drop, "ADBE Scale"), [[0, [85, 85], "e"], [T_IMPACT - 0.08, [80, 125], "l"], [T_IMPACT, [150, 55], "l"]]);
        anim(tr(drop, "ADBE Opacity"), [[T_IMPACT, 100, "l"], [T_IMPACT + 0.04, 0, "l"]]);
        drop.outPoint = T_IMPACT + 0.1;
        drop.motionBlur = true;

        // ---------- 5. Soft ground shadow ----------
        var shd = newShape(comp, "Logo Shadow", [CX, CY + LH / 2 + 22]);
        var sg = addGroup(shd, "Shadow");
        addEllipse(shd, sg, [LW * 0.62, 26]);
        addFill(shd, sg, COL.shadow);
        fx(shd, "ADBE Gaussian Blur 2").property("ADBE Gaussian Blur 2-0001").setValue(22);
        anim(tr(shd, "ADBE Opacity"), [[T_LOGO + 0.2, 0, "e"], [T_LOGO + 0.8, 22, "e"]]);
        anim(tr(shd, "ADBE Scale"), [[T_LOGO + 0.2, [40, 40], "e"], [T_LOGO + 0.8, [100, 100], "e"], [DUR, [104, 104], "l"]]);

        // ---------- 6. Gold outline (badge shape) ----------
        var hw = LW * 0.515, hh = LH * 0.515, cy2 = hh * 0.594, k = hw * 0.56;
        var hexL = newShape(comp, "Gold Outline", [CX, CY]);
        var hg = addGroup(hexL, "Badge Outline");
        addPath(hexL, hg,
            [[0, hh], [-hw, cy2], [-hw, -cy2], [0, -hh], [hw, -cy2], [hw, cy2]],
            [[k, 0], [0, 0], [0, 0], [-k, 0], [0, 0], [0, 0]],
            [[-k, 0], [0, 0], [0, 0], [k, 0], [0, 0], [0, 0]], true);
        addRoundCorners(hexL, hg, 20);
        var hsw = addStroke(hexL, hg, COL.gold, 7);
        var trim = addTrim(hexL, hg);
        anim(trim("ADBE Vector Trim Start"), [[0.6, 50, "eo"], [1.2, 0, "ei"]]);
        anim(trim("ADBE Vector Trim End"), [[0.6, 50, "eo"], [1.2, 100, "ei"]]);
        anim(hsw(), [[1.15, 7, "e"], [1.85, 1, "e"]]);
        anim(tr(hexL, "ADBE Scale"), [[1.15, [100, 100], "eo"], [1.85, [122, 122], "ei"]]);
        anim(tr(hexL, "ADBE Opacity"), [[0.6, 100, "l"], [1.35, 100, "e"], [1.85, 0, "e"]]);
        hexL.inPoint = 0.6; hexL.outPoint = 1.9;
        hexL.motionBlur = true;

        // ---------- 7. LOGO ----------
        var logo = comp.layers.add(footage);
        logo.name = "PUVANA Logo";
        logo.threeDLayer = true;
        logo.motionBlur = true;
        try { if (logoFile.name.match(/\.ai$|\.eps$|\.pdf$/i)) logo.collapseTransformation = true; } catch (e) {}
        tr(logo, "ADBE Position").setValue([CX, CY, 0]);
        function sc(p) { var v = S * p / 100; return [v, v, v]; }
        anim(tr(logo, "ADBE Scale"), [
            [T_LOGO, sc(0), "eo"],
            [T_LOGO + 0.30, sc(110), "e"],
            [T_LOGO + 0.48, sc(96.5), "e"],
            [T_LOGO + 0.62, sc(100.8), "e"],
            [T_LOGO + 0.75, sc(100), "eo"],
            [DUR, sc(103), "l"]
        ]);
        anim(tr(logo, "ADBE Rotate Y"), [[T_LOGO, -80, "eo"], [T_LOGO + 0.7, 0, "s"]]);
        anim(tr(logo, "ADBE Opacity"), [[T_LOGO, 0, "l"], [T_LOGO + 0.12, 100, "l"]]);
        logo.inPoint = T_LOGO;

        // ---------- 8. Shine sweep (masked by the logo alpha) ----------
        var matte = logo.duplicate();
        matte.name = "Logo Matte (shine)";
        var shine = newShape(comp, "Shine Sweep", [CX - LW, CY]);
        var shg = addGroup(shine, "Shine");
        addRect(shine, shg, [110, LH * 2.4]);
        addFill(shine, shg, COL.white, 75);
        tr(shine, "ADBE Rotate Z").setValue(22);
        fx(shine, "ADBE Gaussian Blur 2").property("ADBE Gaussian Blur 2-0001").setValue(35);
        shine.moveAfter(matte);                                   // matte must sit directly above
        try {
            if (typeof shine.setTrackMatte === "function") shine.setTrackMatte(matte, TrackMatteType.ALPHA);
            else shine.trackMatteType = TrackMatteType.ALPHA;
        } catch (e) { shine.trackMatteType = TrackMatteType.ALPHA; }
        matte.enabled = false;
        anim(tr(shine, "ADBE Position"), [[2.2, [CX - LW * 0.9, CY], "e"], [3.0, [CX + LW * 0.9, CY], "e"]]);
        shine.inPoint = 2.1; shine.outPoint = 3.1;
        shine.motionBlur = true;

        // ---------- 9. Gold sparkles ----------
        for (var p = 0; p < 16; p++) {
            var a2 = rrange(0, Math.PI * 2);
            var r0x = LW * 0.42, r0y = LH * 0.42;
            var sx = CX + Math.cos(a2) * r0x, sy = CY + Math.sin(a2) * r0y;
            var push = rrange(90, 230);
            var ex = sx + Math.cos(a2) * push, ey = sy + Math.sin(a2) * push * 0.8;
            var spl = newShape(comp, "Sparkle " + (p + 1), [sx, sy]);
            var spg = addGroup(spl, "Star");
            var big = rrange(10, 22);
            addStar(spl, spg, big, big * 0.18);
            addFill(spl, spg, p % 4 === 0 ? COL.teal : (p % 2 ? COL.gold : COL.goldLight));
            var s0 = T_LOGO + 0.15 + rrange(0, 0.3), sd = rrange(0.7, 1.1);
            anim(tr(spl, "ADBE Position"), [[s0, [sx, sy], "eo"], [s0 + sd, [ex, ey], "ei"]]);
            anim(tr(spl, "ADBE Scale"), [[s0, [0, 0], "e"], [s0 + sd * 0.35, [100, 100], "e"], [s0 + sd, [0, 0], "e"]]);
            anim(tr(spl, "ADBE Rotation"), [[s0, 0, "l"], [s0 + sd, rrange(90, 200), "l"]]);
            spl.inPoint = s0; spl.outPoint = s0 + sd + 0.05;
            spl.motionBlur = true;
        }
        // twinkles on the badge during the shine
        var twk = [[0.36, -0.30, 2.45], [-0.40, 0.18, 2.75], [0.12, -0.45, 2.95]];
        for (var tw = 0; tw < twk.length; tw++) {
            var tl = newShape(comp, "Twinkle " + (tw + 1), [CX + LW * twk[tw][0], CY + LH * twk[tw][1]]);
            var tg = addGroup(tl, "Star");
            addStar(tl, tg, 26, 3.5);
            addFill(tl, tg, COL.white);
            var tt = twk[tw][2];
            anim(tr(tl, "ADBE Scale"), [[tt, [0, 0], "e"], [tt + 0.22, [100, 100], "e"], [tt + 0.5, [0, 0], "e"]]);
            anim(tr(tl, "ADBE Rotation"), [[tt, 0, "l"], [tt + 0.5, 90, "l"]]);
            var glow = fx(tl, "ADBE Glo2");
            try { glow.property("ADBE Glo2-0003").setValue(12); } catch (e) {}   // glow radius
            tl.inPoint = tt; tl.outPoint = tt + 0.55;
        }

        // ---------- 10. Tagline + gold lines ----------
        if (hasTag) {
            var TY = CY + LH / 2 + 95;
            var txt = comp.layers.addText(CFG.tagline);
            txt.name = "Tagline";
            var tp = txt.property("ADBE Text Properties").property("ADBE Text Document");
            var td = tp.value;
            try { td.resetCharStyle(); } catch (e) {}
            td.fontSize = 34;
            try { td.font = CFG.font; } catch (e) {}
            td.applyFill = true;
            td.fillColor = COL.tealDark;
            td.applyStroke = false;
            td.tracking = 260;
            td.justification = ParagraphJustification.CENTER_JUSTIFY;
            tp.setValue(td);
            tr(txt, "ADBE Position").setValue([CX, TY]);

            var animators = txt.property("ADBE Text Properties").property("ADBE Text Animators");
            animators.addProperty("ADBE Text Animator");
            var tAnim = animators.property(1);
            tAnim.name = "Tracking In";
            tAnim.property("ADBE Text Animator Properties").addProperty("ADBE Text Tracking Amount");
            var trkAmt = animators.property(1).property("ADBE Text Animator Properties").property("ADBE Text Tracking Amount");
            anim(trkAmt, [[2.4, 120, "eo"], [3.4, 0, "s"]]);

            var tblur = fx(txt, "ADBE Gaussian Blur 2");
            anim(tblur.property("ADBE Gaussian Blur 2-0001"), [[2.4, 14, "e"], [3.1, 0, "e"]]);
            anim(tr(txt, "ADBE Opacity"), [[2.4, 0, "e"], [2.9, 100, "e"]]);
            anim(tr(txt, "ADBE Position"), [[2.4, [CX, TY + 25], "eo"], [3.2, [CX, TY], "s"]]);
            txt.inPoint = 2.4;
            txt.motionBlur = true;

            var tw2 = 520;
            try { tw2 = txt.sourceRectAtTime(DUR - 0.1, false).width; } catch (e) {}
            var gap = tw2 / 2 + 40, len = 140;
            var sides = [-1, 1];
            for (var sIdx = 0; sIdx < 2; sIdx++) {
                var sgn = sides[sIdx];
                var ln = newShape(comp, (sgn < 0 ? "Gold Line L" : "Gold Line R"), [CX, TY - 11]);
                var lg = addGroup(ln, "Line");
                addPath(ln, lg, [[sgn * gap, 0], [sgn * (gap + len), 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false);
                addStroke(ln, lg, COL.gold, 3);
                var lt = addTrim(ln, lg);
                anim(lt("ADBE Vector Trim End"), [[2.6, 0, "eo"], [3.4, 100, "s"]]);
                ln.inPoint = 2.6;
                ln.motionBlur = true;
            }
        }

        // ---------- 11. Optional fade to white ----------
        if (CFG.fadeOut) {
            var fade = comp.layers.addSolid(COL.white, "Fade To White", W, H, 1, DUR);
            anim(tr(fade, "ADBE Opacity"), [[DUR - 0.6, 0, "e"], [DUR, 100, "e"]]);
        }

        comp.openInViewer();
        comp.time = 3.5;
        alert("PUVANA outro is ready!\nComp: " + CFG.compName + "  (" + DUR + "s @ " + CFG.fps + "fps)\n\nTip: File > Save As to keep the .aep project.");
    } catch (err) {
        alert("Script error (line " + err.line + "):\n" + err.toString());
    } finally {
        app.endUndoGroup();
    }
})();
