
var convCtx;
var font        = "Source Code Pro";
var fontUrl     =
"https://robot.scheffers.net/s/font/saira/saira-v5-latin-regular.ttf";
// "https://fonts.cdnfonts.com/s/12262/PermanentMarker.woff";
var fontGlyphs;
var fontRanges;

var gridElem;
var gridScale   = 10;
var gridDx      = -5;
var gridDy      = -5;
var gridWidth   = 30;
var gridHeight  = 30;
var glyphWidth  = 10;
var glyphHeight = 16;
var glyph       = 65;

var gridData;
var paintValue  = true;

var maxWidth    = 0;

var glyphs      = {};
var glyphToCopy = null;
var unsavedData = false;

var importFileElem;
var saveSelElem;
var saveName    = font;
var storageKey  = null;

function loaded() {
	gridElem = document.getElementById("canvas");
	convCtx = document.getElementById("converter").getContext("2d");
	convCtx.textAlign = "top";
	
	// Importing.
	document.getElementById("font_name").onchange = (event) => {
		font = event.target.value;
		saveData();
	};
	document.getElementById("font_url").onchange = (event) => {
		fontUrl = event.target.value;
		saveData();
	};
	document.getElementById("import").onclick = () => {
		document.getElementById("font_importer").innerHTML =
			`@font-face {
				font-family: ${font};
				src:         url(${JSON.stringify(fontUrl)});
				font-weight: normal;
			}`;
		findGlyphs(fontUrl, () => {
			startFullConversion();
		});
	};
	
	// Visualisation settings.
	document.getElementById("show_grid").oninput = (event) => {
		if (event.target.checked) {
			gridElem.classList.add("grid");
		} else {
			gridElem.classList.remove("grid");
		}
	};
	document.getElementById("show_ruler").oninput = (event) => {
		if (event.target.checked) {
			gridElem.classList.add("ruler");
		} else {
			gridElem.classList.remove("ruler");
		}
	};
	document.getElementById("show_outlines").oninput = (event) => {
		glyphChanged();
	};
	
	// Grid settings.
	document.onkeydown = (event) => {
		if (document.activeElement && document.activeElement.tagName.toLowerCase() == 'input') {
			return;
		}
		if (event.key == '-' || event.key == '_') {
			scaleGrid(-1);
		} else if (event.key == '+' || event.key == '=') {
			scaleGrid(1);
		} else {
			if (event.shiftKey) {
				if (event.key == 'ArrowUp') {
					shiftGrid(0, -1);
				} else if (event.key == 'ArrowDown') {
					shiftGrid(0, 1);
				} else if (event.key == 'ArrowLeft') {
					shiftGrid(-1, 0);
				} else if (event.key == 'ArrowRight') {
					shiftGrid(1, 0);
				}
			} else {
				if (event.key == 'ArrowLeft') {
					selectGlyph(glyph - 1);
				} else if (event.key == 'ArrowRight') {
					selectGlyph(glyph + 1);
				}
			}
		}
	};
	document.getElementById("ruler_x").oninput = (event) => {
		gridDx = -Number(event.target.value);
		resizeGrid(gridWidth, gridHeight);
	};
	document.getElementById("ruler_y").oninput = (event) => {
		gridDy = -Number(event.target.value);
		resizeGrid(gridWidth, gridHeight);
	};
	document.getElementById("glyph_width").oninput = (event) => {
		glyphWidth = Number(event.target.value);
		glyphChanged();
	};
	document.getElementById("glyph_height").oninput = (event) => {
		glyphHeight = Number(event.target.value);
		glyphChanged();
		updateRanges();
	};
	document.getElementById("canvas_width").oninput = (event) => {
		gridWidth = Number(event.target.value);
		enforceGlyphFits(glyphs[glyph]);
		resizeGrid(gridWidth, gridHeight);
	};
	document.getElementById("canvas_height").oninput = (event) => {
		gridHeight = Number(event.target.value);
		enforceGlyphFits(glyphs[glyph]);
		resizeGrid(gridWidth, gridHeight);
	};
	
	// Glyph selection.
	document.getElementById("prev_glyph").onclick = (event) => {
		selectGlyph(glyph - 1);
	}
	document.getElementById("next_glyph").onclick = (event) => {
		selectGlyph(glyph + 1);
	}
	document.getElementById("glyph_text").oninput = (event) => {
		var str = event.target.value;
		if (str.length > 0) {
			selectGlyph(str.codePointAt(str.length - 1));
		}
	}
	document.getElementById("glyph_point").onchange = (event) => {
		var str = event.target.value.trim();
		if (str.toLowerCase().startsWith("u+") || str.toLowerCase().startsWith("0x")) {
			str = str.substring(2);
		}
		var index = parseInt(str, 16);
		if (!isNaN(index) && index > 0) selectGlyph(index);
	};
	
	// Delete glyph.
	document.getElementById("delete_glyph").onclick = (event) => {
		clearGrid();
		deleteGlyph(glyph);
		glyphChanged();
		updateRanges();
	};
	
	// Clear the grid.
	document.getElementById("clear_grid").onclick = () => {
		clearGrid();
		glyphChanged();
		redrawPreview(glyph);
	};
	
	// Copy/paste.
	document.getElementById("copy").onclick = () => {
		glyphToCopy = copyGlyph();
	};
	document.getElementById("paste").onclick = () => {
		pasteGlyph(glyphToCopy);
	};
	
	// Invert all.
	document.getElementById("invert").onclick = () => {
		invertGlyph();
	};
	
	// TRANSLATE... ?
	document.getElementById("shift_up").onclick = () => {
		shiftGrid(0, -1);
	};
	document.getElementById("shift_down").onclick = () => {
		shiftGrid(0, 1);
	};
	document.getElementById("shift_left").onclick = () => {
		shiftGrid(-1, 0);
	};
	document.getElementById("shift_right").onclick = () => {
		shiftGrid(1, 0);
	};
	
	// Advancement.
	document.getElementById("show_advanced").onclick = (event) => {
		document.body.classList.remove("simple");
		if (!event.target.checked) {
			document.body.classList.add("simple");
		}
	};
	if (!document.getElementById("show_advanced").checked) {
		document.body.classList.add("simple");
	}
	
	// Set up the grid!
	document.getElementById("ruler_x").value = -gridDx;
	document.getElementById("ruler_y").value = -gridDy;
	document.getElementById("canvas_width").value = gridWidth;
	document.getElementById("canvas_height").value = gridHeight;
	document.getElementById("glyph_width").value = glyphWidth;
	document.getElementById("glyph_height").value = glyphHeight;
	resizeGrid(gridWidth, gridHeight);
	showGlyphOutlines();
	
	// Save your data!
	saveSelElem = document.getElementById("save_slot");
	saveSelElem.oninput = () => saveSlotSelected(saveSelElem);
	document.getElementById("download").onclick = () => {
		downloadBase64(`${font}.json`, exportData(saveName));
	};
	
	// Importing controls.
	document.getElementById("import_button").onclick = () => {
		document.getElementById("import_file").click();
	};
	
	importFileElem = document.getElementById("import_file")
	importFileElem.onchange = () => {
		if (importFileElem.files[0]) {
			importFileElem.files[0].text().then((text) => {
				if (text.startsWith("pax_font_t")) {
					importFileElem.files[0].arrayBuffer().then((buffer) => {
						importFontFile(new Uint8Array(buffer));
					});
				} else {
					importData(text, false);
				}
			});
		}
	};
	
	// Import storage.
	if ("num_fonts" in localStorage) {
		for (var i = 0; i < localStorage.getItem("num_fonts"); i++) {
			var data       = JSON.parse(atob(localStorage.getItem(`fonts_${i}`)));
			var optn       = document.createElement("option");
			optn.value     = `fonts_${i}`;
			optn.innerHTML = data.name;
			saveSelElem.options.add(optn);
		}
		saveSelElem.value  = localStorage.getItem("font_selected");
		saveSlotSelected(saveSelElem);
	}
	
	// Import it?
	if (saveSelElem.value == "new_slot") {
		saveSelElem.value = "unsaved";
	} else if (saveSelElem.value in localStorage) {
		saveSlotSelected(saveSelElem);
	}
	
	// Exporting options.
	document.getElementById("export_c_h").onclick = () => {
		if (document.getElementById("export_mono").checked) {
			if (!isMonospaceFont()) {
				alert("Cannot export as monospace font");
				return;
			}
			var id = convertName(font);
			var bpp = +document.getElementById("bpp").value;
			var exported = exportMonospaceSimple(id, glyphWidth, glyphHeight, bpp, font, true);
			downloadBase64(font + ".c", exported.c);
			downloadBase64(font + ".h", exported.h);
		} else {
			var id = convertName(font);
			var bpp = +document.getElementById("bpp").value;
			var exported = exportVariable(id, glyphHeight, bpp, font, true);
			downloadBase64(font + ".c", exported.c);
			downloadBase64(font + ".h", exported.h);
		}
	};
	document.getElementById("export_file").onclick = () => {
		if (document.getElementById("export_mono").checked) {
			if (!isMonospaceFont()) {
				alert("Cannot export as monospace font");
				return;
			}
			var bpp = +document.getElementById("bpp").value;
			exported = exportFontFile(glyphHeight, bpp, font, true);
			downloadBinary(font + ".pax_font", exported, false);
		} else {
			var bpp = +document.getElementById("bpp").value;
			exported = exportFontFile(glyphHeight, bpp, font, false);
			downloadBinary(font + ".pax_font", exported, false);
		}
	};
}



/* ==== Grid functions ==== */

// Scale the grid.
function scaleGrid(delta) {
	gridScale += delta;
	if (gridScale < 3) gridScale = 3;
	else if (gridScale > 30) gridScale = 30;
	var fancy = document.getElementById("grid_zoomer");
	fancy.innerHTML = `#canvas td {
		width:  ${gridScale}px;
		height: ${gridScale}px;
	}`;
}

// Create the grid.
function makeGrid(elem, id, dx, dy, width, height, callback) {
	var raw = "<table>";
	for (var y = 0; y < height; y++) {
		raw += `<tr y="${y+dy}">`;
		for (var x = 0; x < width; x++) {
			raw += `<td id="${id}_${x}_${y}" x="${x+dx}" y="${y+dy}"></td>`;
		}
		raw += `</tr>`;
	}
	raw += "</table>";
	elem.innerHTML = raw;
	if (callback) {
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				var cell = document.getElementById(`${id}_${x}_${y}`);
				callback(cell, x, y, x+dx, y+dy);
			}
		}
	}
	
	var data = Array(height);
	for (var y = 0; y < height; y++) {
		data[y] = Array(width);
		data[y].fill(false);
	}
	return data;
}

// Resize the grid.
function resizeGrid(w, h, select=true) {
	gridWidth  = w;
	gridHeight = h;
	
	gridData = makeGrid(
		document.getElementById("canvas"), "canvas", 
		gridDx, gridDy, gridWidth, gridHeight,
		(elem, x, y, px, py) => {
		elem.onmousedown = () => {
			paintCell(x, y, undefined);
			glyphChanged();
			redrawPreview(glyph);
		};
		elem.onmouseenter = (event) => {
			if (event.buttons) {
				paintCell(x, y, paintValue);
				glyphChanged();
				redrawPreview(glyph);
			}
		};
	});
	
	if (select)
		selectGlyph(glyph);
}

// Shift the contents of the grid.
function shiftGrid(dx, dy) {
	if (dx < 0) {
		for (var y = 0; y < gridHeight; y++) {
			for (var x = 0; x < gridWidth - 1; x++) {
				gridData[y][x] = gridData[y][x + 1];
			}
		}
		for (var y = 0; y < gridHeight; y++) {
			gridData[y][gridWidth - 1] = false;
		}
	} else if (dx > 0) {
		for (var y = 0; y < gridHeight; y++) {
			for (var x = gridWidth - 2; x >= 0; x--) {
				gridData[y][x + 1] = gridData[y][x];
			}
		}
		for (var y = 0; y < gridHeight; y++) {
			gridData[y][0] = false;
		}
	}
	if (dy < 0) {
		for (var y = 0; y < gridHeight - 1; y++) {
			gridData[y] = gridData[y + 1];
		}
		gridData[gridHeight - 1] = Array(gridWidth).fill(0)
	} else if (dy > 0) {
		for (var y = gridHeight - 2; y >= 0; y--) {
			gridData[y + 1] = gridData[y];
		}
		gridData[0] = Array(gridWidth).fill(0)
	}
	glyphChanged();
	redrawPreview(glyph);
	selectGlyph(glyph);
}

// Show or hide glyph outlines.
function showGlyphOutlines(value) {
	if (value == undefined) {
		value = document.getElementById("show_outlines").checked;
	}
	
	// Remove outline bits.
	document.querySelectorAll("#canvas td").forEach((elem) => {
		elem.classList.remove("outline-left", "outline-top", "glyph-left", "glyph-top");
	});
	if (!value) return;
	
	function outline(x, y, width, height, left, top) {
		// Top and bottom lines.
		for (var i = x; i < x + width; i++) {
			document.querySelectorAll(
				`#canvas td[x="${i}"][y="${y}"],`
			  + `#canvas td[x="${i}"][y="${y+height}"]`
			).forEach((elem) => {
				elem.classList.add(top);
			});
		}
		
		// Left and right lines.
		for (var i = y; i < y + height; i++) {
			document.querySelectorAll(
				`#canvas td[y="${i}"][x="${x}"],`
			  + `#canvas td[y="${i}"][x="${x+width}"]`
			).forEach((elem) => {
				elem.classList.add(left);
			});
		}
	}
	
	// Outline of formal size.
	outline(0, 0, glyphWidth, glyphHeight, "outline-left", "outline-top");
	
	// Detect actual size.
	var dims = getGlyphBounds();
	// Outline of actual size.
	if (dims) {
		outline(
			dims.x,
			dims.y,
			dims.width,
			dims.height,
			"glyph-left", "glyph-top"
		);
	}
}

// Extract data from the grid.
function extractGridData(dx, dy, width, height) {
	var data = Array(height);
	for (var y = 0; y < height; y++) {
		data[y] = Array(width);
		for (var x = 0; x < width; x++) {
			data[y][x] = gridData[y + dy - gridDy][x + dx - gridDx];
		}
	}
	return data;
}

// Clear the entire grid.
function clearGrid() {
	for (var y = 0; y < gridHeight; y++) {
		for (var x = 0; x < gridWidth; x++) {
			gridData[y][x] = 0;
		}
	}
	document.querySelectorAll("#canvas td").forEach(
		(elem) => elem.style.backgroundColor = "white"
	);
}

// Insert data into the grid.
function insertData(dx, dy, width, height, data) {
	if (gridWidth < width && gridHeight < height) resizeGrid(width, height);
	else if (gridWidth < width) resizeGrid(width, gridHeight);
	else if (gridHeight < height) resizeGrid(gridWidth, height);
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var value = gridData[y + dy - gridDy][x + dx - gridDx] = data[y][x];
			var elem  = document.querySelector(`#canvas td[x="${x+dx}"][y="${y+dy}"]`);
			var rounded = 255 - Math.round(value * 255);
			elem.style.backgroundColor = `#${Number(rounded).toString(16).repeat(3)}`;
		}
	}
	showGlyphOutlines(undefined);
}

// Enforce a certain glyph fits in the grid.
function enforceGlyphFits(data) {
	var resize = false;
	if (!data || !data.bounds) return true;
	if (data.bounds.x < gridDx) {
		gridWidth += data.bounds.x - gridDx;
		gridDx     = data.bounds.x;
		resize     = true;
	}
	if (data.bounds.y < gridDy) {
		gridHeight += data.bounds.y - gridDy;
		gridDy      = data.bounds.y;
		resize     = true;
	}
	if (data.bounds.x + data.bounds.width - gridDx >= gridWidth) {
		gridWidth = data.bounds.x + data.bounds.width - gridDx;
		resize     = true;
	}
	if (data.bounds.y + data.bounds.height - gridDy >= gridHeight) {
		gridWidth = data.bounds.x + data.bounds.width - gridDx;
		resize     = true;
	}
	return resize;
}


/* ==== Editor functions ==== */

// Convert a glyph from a pre-existing font into the current slot.
function convertGlyphToCurrent(font, text, threshold=127) {
	var bpp = Number(document.querySelector("#bpp").value);
	var resolution = (1 << bpp) - 1;
	
	// Paint the font thingy.
	convCtx.clearRect(0, 0, 200, 200);
	convCtx.font         = `${glyphHeight}px ${font}`;
	convCtx.textBaseline = "top";
	convCtx.fillStyle    = "black";
	convCtx.fillText(text, -gridDx, -gridDy);
	
	// Get the dimensions.
	glyphWidth = Math.ceil(convCtx.measureText(text).width);
	document.getElementById("glyph_width").value = glyphWidth;
	
	// Get the data into the GRID.
	var arr = convCtx.getImageData(0, 0, gridWidth, gridHeight).data;
	for (var y = 0; y < gridHeight; y++) {
		for (var x = 0; x < gridWidth; x++) {
			// We care about the alpha value of pixels.
			var index = (y * gridWidth + x) * 4 + 3;
			var value = arr[index] / 255;
			value = Math.round(value * resolution) / resolution;
			setCell(x, y, value);
		}
	}
	showGlyphOutlines(undefined);
	glyphChanged();
	redrawPreview(glyph);
}

// Start the process of converting the entire font's glyphs.
var conversionProgress;
function startFullConversion() {
	conversionProgress = 0;
	var callback = () => {
		if (conversionProgress >= fontGlyphs.length) return;
		var point = fontGlyphs[conversionProgress];
		selectGlyph(point);
		convertGlyphToCurrent(font, String.fromCodePoint(point));
		conversionProgress ++;
		setTimeout(callback, 5);
	};
	setTimeout(callback, 5);
}

// Paint a single pixel of the glyph.
// Argument paint: True is increase, False is decrease.
function paintCell(x, y, paint) {
	var bpp = Number(document.querySelector("#bpp").value);
	var resolution = (1 << bpp) - 1;
	
	if (paint == undefined) {
		paint = gridData[y][x] < 0.5;
	}
	paintValue = !!paint;
	paint = paint ? 1 : -1;
	
	// Compute the new value.
	var oldVal = gridData[y][x];
	var newVal = (Math.round(oldVal * resolution) + paint) / resolution;
	newVal = Math.max(0, Math.min(1, newVal));
	
	// Set it.
	setCell(x, y, newVal);
}

// Set the absolute value of a single pixel of the glyph.
function setCell(x, y, value) {
	var rounded = 255 - Math.round(value * 255);
	
	// Update the big grid.
	var elem = document.getElementById(`canvas_${x}_${y}`);
	elem.style.backgroundColor = `#${Number(rounded).toString(16).repeat(3)}`;
	elem.setAttribute("value", value);
	
	// Update some datas.
	gridData[y][x] = value;
	unsavedData = true;
}

// Copy the data of another glyph.
function copyGlyph() {
	// Get raw data.
	var data = glyphs[glyph];
	var copy = {
		glyph:   data.glyph,
		visible: data.visible,
		width:   glyphWidth,
		data: [],
	};
	if (copy.visible) {
		// Copy bounds.
		copy.bounds = {
			x:      data.bounds.x,
			y:      data.bounds.y,
			width:  data.bounds.width,
			height: data.bounds.height,
		};
		copy.data = Array(data.bounds.height);
		// Copy data.
		for (var y = 0; y < data.bounds.height; y++) {
			copy.data[y] = Array(data.bounds.width);
			for (var x = 0; x < data.bounds.width; x++) {
				copy.data[y][x] = data.data[y][x];
			}
		}
	}
	return copy;
}

// Copy the data of another glyph onto the current.
function pasteGlyph(data) {
	if (data) {
		glyphWidth = data.width;
		document.getElementById("glyph_width").value = glyphWidth;
		if (data.visible) {
			document.getElementById("glyph_width").value = glyphWidth;
			insertData(data.bounds.x, data.bounds.y, data.bounds.width, data.bounds.height, data.data);
		}
	}
	glyphChanged();
	showGlyphOutlines(undefined);
	redrawPreview(glyph);
}

// Delete a glyph by index.
function deleteGlyph(glyph) {
	let i = fontGlyphs.indexOf(glyph);
	if (i < 0) return;
	delete glyphs[glyph];
	fontGlyphs.splice(i, 1);
}

// Delete a range of glyphs.
function deleteRange(start, end) {
	if (glyph >= start && glyph <= end) clearGrid();
	for (var i = start; i <= end; i++) {
		deleteGlyph(i);
	}
	glyphChanged();
	updateRanges();
}

// Invert the current glyph's data.
// Only inverts inside the drawn region.
function invertGlyph() {
	var dims = getGlyphBounds();
	
	// Iterate the drawn region.
	for (var y = dims.y - gridDy; y < dims.y - gridDy + dims.height; y++) {
		for (var x = dims.x - gridDx; x < dims.x - gridDx + dims.width; x++) {
			setCell(x, y, 1 - gridData[y][x]);
		}
	}
	
	glyphChanged();
	redrawPreview(glyph);
}

// Find all the glyphs in the font using some magic.
function findGlyphs(fontUrl, then=undefined) {
	var out = [];
	opentype.load(fontUrl, (err, font) => {
		if (!font) return;
		
		// Do some simple data conversion.
		for (var i = 0; i < font.glyphs.length; i++) {
			var unicode = font.glyphs.glyphs[i].unicode;
			if (unicode)
				out = out.concat(unicode);
		}
		// Sort code points.
		fontGlyphs = out.sort((a, b) => a - b);
		
		// Fart out some ranges HTML.
		updateRanges();
		if (then) then();
	});
}

// Update the entire ranges table.
function updateRanges() {
	if (!fontGlyphs) return;
	
	// Create ranges of code points.
	var start  = fontGlyphs[0];
	var prev   = start;
	var ranges = [];
	for (var i = 1; i < fontGlyphs.length; i++) {
		if (prev + 1 != fontGlyphs[i]) {
			ranges = ranges.concat({start: start, end: prev});
			start = fontGlyphs[i];
		}
		prev = fontGlyphs[i];
	}
	ranges = ranges.concat({start: start, end: prev});
	fontRanges = ranges;
	
	// Generate some raw HTMLs.
	var raw = `<h1>GLYPHS</h1>`;
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		raw += `<p>${unicodeNumber(range.start)} - ${unicodeNumber(range.end)}</p>`;
		raw += `<canvas id="range_${i}"></canvas>`;
	}
	document.getElementById("glyphs").innerHTML = raw;
	
	// Let's draw some crap.
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		var count = range.end - range.start + 1;
		var elem = document.getElementById(`range_${i}`);
		elem.width = 8 * 2 * glyphHeight;
		elem.height = glyphHeight * Math.floor(count / 8) + glyphHeight;
		
		for (var glyph = range.start; glyph <= range.end; glyph ++) {
			redrawPreview(glyph);
		}
	}
}

// Redraw the preview of a glyph.
function redrawPreview(glyph) {
	if (!fontRanges) return;
	
	// Find the appropriate range.
	var index = -1;
	for (var i = 0; i < fontRanges.length; i++) {
		if (glyph >= fontRanges[i].start && glyph <= fontRanges[i].end) {
			index = i;
			break;
		}
	}
	if (index == -1) return;
	var range = fontRanges[index];
	
	// Find some more context.
	var ctx   = document.getElementById(`range_${index}`).getContext("2d");
	var dx    = (glyph - range.start) % 8;
	var dy    = Math.floor((glyph - range.start) / 8);
	dx       *= glyphHeight * 2;
	dy       *= glyphHeight;
	var data  = glyphs[glyph];
	
	// Start drawing!
	ctx.fillStyle = "white";
	ctx.fillRect(dx, dy, glyphHeight * 2, glyphHeight);
	if (data && data.visible) {
		dx += data.bounds.x;
		dy += data.bounds.y;
		for (var y = 0; y < data.bounds.height; y++) {
			for (var x = 0; x < data.bounds.width; x++) {
				var value = data.data[y][x];
				var rounded = 255 - Math.round(value * 255);
				ctx.fillStyle = `#${Number(rounded).toString(16).repeat(3)}`;
				ctx.fillRect(x+dx, y+dy, 1, 1);
			}
		}
	}
}

// Get a U+xxxxx representation of a number.
function unicodeNumber(num) {
	var str = Number(num).toString(16);
	return "U+" + "0".repeat(5 - str.length) + str;
}



/* ==== Saving functions ==== */

// Select a glyph.
function selectGlyph(codepoint) {
	if (codepoint < 0) codepoint = 0;
	
	var strGlyph = String.fromCodePoint(codepoint);
	document.getElementById("glyph_text").value = strGlyph;
	document.getElementById("glyph_point").value = unicodeNumber(codepoint);
	glyph = codepoint;
	
	var data = glyphs[glyph];
	clearGrid();
	if (data) {
		document.getElementById("glyph_width").value = glyphWidth;
		if (data.visible) {
			
			// Enforce grid is big enough.
			if (enforceGlyphFits(data)) {
				resizeGrid(gridWidth, gridHeight, false);
			}
			
			// Insert data.
			glyphWidth = data.width;
			document.getElementById("glyph_width").value = glyphWidth;
			insertData(data.bounds.x, data.bounds.y, data.bounds.width, data.bounds.height, data.data);
		}
	}
	showGlyphOutlines(undefined);
}

// Calculates the actual filled in bounds of the glyph.
function getGlyphBounds() {
	var x0 =  Infinity, y0 =  Infinity;
	var x1 = -Infinity, y1 = -Infinity;
	for (var y = 0; y < gridHeight; y++) {
		for (var x = 0; x < gridWidth; x++) {
			if (gridData[y][x] <= 0.001) continue;
			x0 = Math.min(x0, x);
			y0 = Math.min(y0, y);
			x1 = Math.max(x1, x);
			y1 = Math.max(y1, y);
		}
	}
	
	if (isFinite(x0) && isFinite(y0)) {
		return {
			x:      x0 + gridDx,
			y:      y0 + gridDy,
			width:  x1 - x0 + 1,
			height: y1 - y0 + 1
		};
	} else {
		return null;
	}
}

// Handles change events.
// Called when any of the glyph's parameters or data is changed.
function glyphChanged() {
	// Update the outlines, if applicable.
	showGlyphOutlines(undefined);
	
	// Make the glyph data.
	var dims = getGlyphBounds();
	var data;
	if (dims) {
		data = {
			glyph:   glyph,
			visible: true,
			bounds:  dims,
			width:   glyphWidth,
			data:    extractGridData(dims.x, dims.y, dims.width, dims.height),
		};
		
		if (!fontGlyphs) {
			fontGlyphs = [glyph];
			updateRanges();
		} else if (!fontGlyphs.includes(glyph)) {
			fontGlyphs = fontGlyphs.concat(glyph).sort((a, b) => a - b);
			updateRanges();
		}
	} else {
		data = {
			glyph:   glyph,
			visible: false,
			width:   glyphWidth,
		}
	}
	
	// Insert glyph data.
	glyphs[glyph] = data;
	saveData();
}

// Saves the current font to local storage.
function saveData() {
	// Update the save slot.
	if (saveSelElem.value != "unsaved") {
		if (!saveName) saveName = font;
		var key   = saveSelElem.value;
		var data  = exportData(saveName, true);
		localStorage.setItem(key, data);
	}
}

// Exports the font as JSON, optionally base64 encoded.
function exportData(name="Unnamed", doBase64=false) {
	var toExport = {
		url:          fontUrl,
		font:         font,
		name:         name,
		
		glyphs:       glyphs,
		glyphSel:	  glyph,
		glyphList:    fontGlyphs,
		glyphRanges:  fontRanges,
		glyphHeight:  glyphHeight,
		
		gridDx:       gridDx,
		gridDy:       gridDy,
		gridWidth:    gridWidth,
		gridHeight:   gridHeight,
		
		showGrid:     document.getElementById("show_grid").checked,
		showRuler:    document.getElementById("show_ruler").checked,
		showOutlines: document.getElementById("show_outlines").checked,
	};
	if (doBase64) {
		return btoa(JSON.stringify(toExport));
	} else {
		return JSON.stringify(toExport, undefined, "\t");
	}
}

// Imports the font from JSON, optionally base64 encoded.
function importData(input, doBase64=false) {
	// Import the funny data.
	var importData;
	if (doBase64) {
		importData = JSON.parse(atob(input));
	} else {
		importData = JSON.parse(input);
	}
	
	fontUrl     = importData.url,
	font        = importData.font,
	saveName    = importData.name,
	
	glyphs      = importData.glyphs;
	fontGlyphs  = importData.glyphList;
	fontRanges  = importData.glyphRanges;
	glyphHeight = importData.glyphHeight;
	
	gridDx      = importData.gridDx;
	gridDy      = importData.gridDy;
	gridWidth   = importData.gridWidth;
	gridHeight  = importData.gridHeight;
	
	document.getElementById("font_name").value       = importData.font;
	document.getElementById("font_url").value        = importData.url;
	
	document.getElementById("ruler_x").value         = -gridDx;
	document.getElementById("ruler_y").value         = -gridDy;
	document.getElementById("glyph_height").value    = glyphHeight;
	
	document.getElementById("show_grid").checked     = importData.showGrid;
	document.getElementById("show_ruler").checked    = importData.showRuler;
	document.getElementById("show_outlines").checked = importData.showOutlines;
	
	gridWidth  = Math.max(-2*gridDx + glyphWidth,  glyphWidth,  gridWidth);
	gridHeight = Math.max(-2*gridDx + glyphHeight, glyphHeight, gridHeight);
	document.getElementById("canvas_width").value  = gridWidth;
	document.getElementById("canvas_height").value = gridHeight;
	
	gridElem.classList.remove("grid", "ruler");
	if (importData.showGrid) gridElem.classList.add("grid");
	if (importData.showRuler) gridElem.classList.add("ruler");
	
	resizeGrid(gridWidth, gridHeight);
	selectGlyph(importData.glyphSel);
	updateRanges();
}

// Called when the save slot dropdown changes.
function saveSlotSelected(elem, old_value="unsaved") {
	if (elem.value == "new_slot") {
		// Save to storage.
		var name  = prompt("Save font to new slot", font);
		if (!name) {
			elem.value = old_value;
			return;
		}
		
		var index;
		if ("num_fonts" in localStorage) {
			index = Number(localStorage.getItem("num_fonts"));
		} else {
			index = 0;
		}
		var key   = `fonts_${index}`;
		var data  = exportData(name, true);
		localStorage.setItem(key, data);
		localStorage.setItem("num_fonts", index + 1);
		saveName  = name;
		
		// Update the list.
		var optn       = document.createElement("option");
		optn.value     = key;
		optn.innerHTML = name;
		saveSelElem.options.add(optn);
		elem.value     = key;
	} else if (elem.value != "unsaved") {
		// Retrieve from storage.
		importData(localStorage.getItem(elem.value), true);
	}
	
	localStorage.setItem("font_selected", saveSelElem.value);
}

// Downloads your text file.
function downloadBase64(name, data, isText=true) {
	var a = document.createElement("a");
	a.href = `data:application/octet-stream;${isText?'charset=utf-8;':''}base64,${btoa(data)}`;
	a.setAttribute("download", name);
	a.click();
}

// Turns binary into base64.
function bin2b64(binary) {
	let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	
	// Dirty way: Turn binary into array of bits.
	var bits = [];
	for (var i = 0; i < binary.length; i++) {
		var tmp = binary[i];
		for (var x = 0; x < 8; x++) {
			bits[i*8 + x] = (tmp & 128) ? 1 : 0;
			tmp <<= 1;
		}
	}
	
	// Then, collect the bits.
	var out = "";
	for (i = 0; i < bits.length; i += 6) {
		var tmp = 0;
		for (var x = 0; x < 6; x++) {
			tmp <<= 1;
			tmp  |= bits[i + x] == 1;
		}
		out += alphabet[tmp];
	}
	
	// Add padding.
	var padd = 4 - out.length % 4;
	if (padd != 4) out += "=".repeat(padd);
	
	return out;
}

// Downloads your binary file.
function downloadBinary(name, data) {
	var a = document.createElement("a");
	a.href = `data:application/octet-stream;base64,${bin2b64(data)}`;
	a.setAttribute("download", name);
	a.click();
}

// CONSUMES a 8-bit number from a Uint8Array.
function readU8(stream) {
	if (stream.index >= stream.data.length) {
		throw Error("Out of data");
	}
	return stream.data[stream.index++] & 0xff;
}

// CONSUMES a 8-bit number from a Uint8Array.
function readI8(stream) {
	if (stream.index >= stream.data.length) {
		throw Error("Out of data");
	}
	var nombre = stream.data[stream.index++] & 0xff;
	if (nombre & 0x80)
		return - ((nombre^0xff)+1);
	else
		return nombre;
}

// CONSUMES a 16-bit number from a Uint8Array.
function readU16(stream) {
	let b0 = readU8(stream), b1 = readU8(stream);
	return b0 + b1 * 0x100;
}

// CONSUMES a 16-bit number from a Uint8Array.
function readU32(stream) {
	let b0 = readU8(stream), b1 = readU8(stream), b2 = readU8(stream), b3 = readU8(stream);
	return b0 + b1 * 0x100 + b2 * 0x10000 + b3 * 0x1000000;
}

// CONSUMES a 16-bit number from a Uint8Array.
function readU64(stream) {
	let b0 = readU8(stream), b1 = readU8(stream), b2 = readU8(stream), b3 = readU8(stream);
	let b4 = readU8(stream), b5 = readU8(stream), b6 = readU8(stream), b7 = readU8(stream);
	return b0 + b1 * 0x100 + b2 * 0x10000 + b3 * 0x1000000
		+ b4 * 0x100000000 + b5 * 0x10000000000 + b6 * 0x1000000000000 + b7 * 0x100000000000000;
}

// CONSUMES a string form a Uint8Array.
function readString(stream, len) {
	if (stream.data.length < stream.index + len) {
		throw Error("Out of data");
	}
	var data = stream.data.subarray(stream.index, stream.index + len);
	stream.index += len;
	return new TextDecoder().decode(data);
}

// CONSUMES a few bytes from a Uint8Array.
function readBytes(stream, len) {
	if (stream.data.length < stream.index + len) {
		throw Error("Out of data");
	}
	var data = stream.data.subarray(stream.index, stream.index + len);
	stream.index += len;
	return data;
}

// Imports the font from PAX font file.
function importFontFile(data) {
	var stream = { data: data, index: 0 };
	var detBPP = 1;
	
	// Check magic.
	var magic_str = readString(stream, 11);
	if (magic_str != "pax_font_t\0") {
		throw Error("File magic mismatch");
	}
	
	// Check loader version.
	var loader_ver = readU16(stream);
	if (loader_ver != 1) {
		throw Error("Unsupported font version " + loader_ver + " (supported: 1)");
	}
	
	// Number of stored pax_bmpv_t.
	var n_bmpv     = readU64(stream);
	// Size of the combined bitmaps.
	var n_bitmap   = readU64(stream);
	// Size of the font name.
	var n_name     = readU64(stream);
	// Number of ranges in the font.
	var n_ranges   = readU64(stream);
	
	// Default point size.
	var default_sz = readU16(stream);
	// Whether antialiassing is recommended.
	var do_aa      = readU8(stream);
	
	fontUrl     = "";
	
	glyphs      = {};
	fontGlyphs  = [];
	fontRanges  = [];
	glyphHeight = default_sz;
	
	for (var i = 0; i < n_ranges; i++) {
		// Range type (0: monospace, 1: variable pitch).
		let rtype  = readU8(stream);
		// Range start glyph.
		let rstart = readU32(stream);
		// Range end glyph.
		let rend   = readU32(stream);
		
		// Range length.
		let rlen   = rend - rstart + 1;
		
		if (rtype == 0 /* PAX_FONT_TYPE_BITMAP_MONO */) {
			// Range width.
			let gwidth  = readU8(stream);
			// Range height.
			let gheight = readU8(stream);
			// Range bits per pixel.
			let gbpp    = readU8(stream);
			if (gbpp > detBPP) detBPP = gbpp;
			
			// Construct range objects.
			for (var x = rstart; x <= rend; x++) {
				glyphs[x] = {
					bounds: { x: 0, y: 0, width: gwidth, height: gheight },
					glyph: x,
					width: gwidth
				};
			}
			fontRanges = fontRanges.concat({
				start: rstart, end: rend, bpp: gbpp, type: rtype, width: gwidth, height: gheight
			});
			
		} else if (rtype == 1 /* PAX_FONT_TYPE_BITMAP_VAR */) {
			// Range height.
			let gheight = readU8(stream);
			// Range bits per pixel.
			let gbpp    = readU8(stream);
			if (gbpp > detBPP) detBPP = gbpp;
			
			// Construct range objects.
			for (var x = rstart; x <= rend; x++) {
				// Bitmap draw X offset.
				let dx = readI8(stream);
				// Bitmap draw Y offset.
				let dy = readI8(stream);
				// Bitmap drawn width.
				let dw = readU8(stream);
				// Bitmap drawn height.
				let dh = readU8(stream);
				// Bitmap measured width.
				let gwidth = readU8(stream);
				// Bitmap index.
				let gindex = readU64(stream);
				
				glyphs[x] = {
					bounds: { x: dx, y: dy, width: dw, height: dh },
					glyph: x,
					width: gwidth,
					bmpindex: gindex
				};
			}
			fontRanges = fontRanges.concat({
				start: rstart, end: rend, bpp: gbpp, type: rtype
			});
			
		} else {
			throw Error("File corruption: Font type invalid (" + rtype + " in range " + i + ", offset " + (stream.index-8) + ")");
		}
	}
	
	// Interpret bitmap data.
	for (var i = 0; i < fontRanges.length; i++) {
		let range = fontRanges[i];
		if (range.type == 0 /* PAX_FONT_TYPE_BITMAP_MONO */) {
			// Determine size parameters.
			let bpp   = range.bpp;
			let ppb   = Math.floor(8 / bpp);
			let y_mul = Math.floor((range.width * bpp + 7) / 8);
			let glen  = y_mul * range.height;
			let mask  = (1 << bpp) - 1;
			let imask = ppb - 1;
			
			for (var glyph = range.start; glyph <= range.end; glyph++) {
				fontGlyphs = fontGlyphs.concat(glyph);
				// Collect raw glyph data.
				let raw    = readBytes(stream, glen);
				// Read pixels.
				glyphs[glyph].data = [];
				glyphs[glyph].visible = false;
				for (var y = 0; y < range.height; y++) {
					glyphs[glyph].data[y] = [];
					for (var x = 0; x < range.width; x++) {
						// Extract pixel data.
						let gindex  = Math.floor(x / ppb) + y_mul * y;
						let pixdat  = (raw[gindex] >> (bpp * (x & imask))) & mask;
						let fpixdat = pixdat / mask;
						glyphs[glyph].visible |= !!pixdat;
						
						// Write to glyph data.
						glyphs[glyph].data[y][x] = fpixdat;
					}
				}
			}
			
		} else /* PAX_FONT_TYPE_BITMAP_VAR */ {
			for (var glyph = range.start; glyph <= range.end; glyph++) {
				fontGlyphs = fontGlyphs.concat(glyph);
				// Determine size parameters.
				let bpp   = range.bpp;
				let ppb   = Math.floor(8 / bpp);
				let y_mul = Math.floor((glyphs[glyph].bounds.width * bpp + 7) / 8);
				let glen  = y_mul * glyphs[glyph].bounds.height;
				let mask  = (1 << bpp) - 1;
				let imask = ppb - 1;
				
				// Collect raw glyph data.
				let raw    = readBytes(stream, glen);
				// Read pixels.
				glyphs[glyph].data = [];
				glyphs[glyph].visible = false;
				for (var y = 0; y < glyphs[glyph].bounds.height; y++) {
					glyphs[glyph].data[y] = [];
					for (var x = 0; x < glyphs[glyph].bounds.width; x++) {
						// Extract pixel data.
						let gindex  = Math.floor(x / ppb) + y_mul * y;
						let pixdat  = (raw[gindex] >> (bpp * (x & imask))) & mask;
						glyphs[glyph].visible |= !!pixdat;
						let fpixdat = pixdat / mask;
						
						// Write to glyph data.
						glyphs[glyph].data[y][x] = fpixdat;
					}
				}
			}
			
		}
	}
	
	font = readString(stream, n_name);
	saveName = font;
	document.getElementById("font_name").value = font;
	document.getElementById("bpp").value = detBPP;
	updateRanges();
	selectGlyph(0x41);
	glyphChanged();
}



/* ==== Exporting functions ==== */

// Test whether the current font can be exported as monospace.
function isMonospaceFont() {
	let w = glyphWidth;
	let h = glyphHeight;
	for (glyph in glyphs) {
		if (glyphs[glyph].width != w) {
			return false;
		}
	}
	return true;
}

// Converts raw glyph data to bytes.
function glyphToBytes(width, height, data, bpp) {
	var resolution = (1 << bpp) - 1;
	var bytesPerLine = Math.ceil(width * bpp / 8);
	var out = Array(bytesPerLine * height);
	
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var bitIndex    = (x*bpp) % 8;
			var byteIndex   = Math.floor((x*bpp) / 8) + bytesPerLine * y;
			var rounded     = Math.round(data[y][x] * resolution);
			out[byteIndex] |= rounded << bitIndex;
		}
	}
	
	return out;
}

// Glyph to bytes: monospace edition.
function monoGlyphToBytes(width, height, bounds, data, bpp) {
	var resolution = (1 << bpp) - 1;
	var bytesPerLine = Math.ceil(width * bpp / 8);
	var out = Array(bytesPerLine * height);
	
	for (var y = 0; y < bounds.height; y++) {
		for (var x = 0; x < bounds.width; x++) {
			var bitIndex    = ((x + bounds.x)*bpp) % 8;
			var byteIndex   = Math.floor(((x + bounds.x)*bpp) / 8) + bytesPerLine * (y + bounds.y);
			var rounded     = Math.round(data[y][x] * resolution);
			out[byteIndex] |= rounded << bitIndex;
		}
	}
	
	return out;
}

// Converts an integer array to a C constant.
function intArrToC(type, name, data) {
	var out = `const ${type} ${name}[] = {\n\t`;
	for (index in data) {
		out += `${String(data[index])}, `;
	}
	out += `\n};\nconst size_t ${name}_len = sizeof(${name}) / sizeof(${type});\n`;
	return out;
}

// Converts a data/prototype pair to an anonymous C constant.
function objectToC(data, prototype, isConst=true) {
	if (prototype._typename === "__integer") {
		return parseInt(data);
	} else if (prototype._typename === "char*") {
		return JSON.stringify(String(data));
	}
	
	var out = `(${isConst?"const":""} ${prototype._typename}){`;
	
	for (var i = 0; i < prototype.fields.length; i++) {
		var key = prototype.fields[i].name;
		if (data[key]) {
			out += `.${key}=${objectToC(data[key])}`;
		}
	}
}

// Exports the font as monospace, cropping anything outsize the box.
function exportMonospaceSimple(id, width, height, bpp, name, split=true) {
	console.log("Exporting monspace font '" + name + "' (" + id + "; " + width + "x" + height + "; " + bpp + "bpp)");
	var raw = '#include <pax_fonts.h>\n// Raw data.\n';
	
	// Start with outputting some ranges.
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		var bytes = [];
		for (var glyph = range.start; glyph <= range.end; glyph++) {
			selectGlyph(glyph);
			var data = extractGridData(0, 0, width, height);
			bytes = bytes.concat(glyphToBytes(width, height, data, bpp));
		}
		raw += intArrToC('uint8_t', `${id}_r${i}`, bytes);
	}
	
	// Create the combining parts.
	raw += `// Combined ranges.\nconst pax_font_range_t ${id}_ranges[] = {\n`;
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		raw +=
			`{ // Range ${i+1} / ${fontRanges.length}.\n`+
			`	.type  = PAX_FONT_TYPE_BITMAP_MONO,\n`+
			`	.start = 0x${range.start.toString(16)},\n`+
			`	.end   = 0x${range.end.toString(16)},\n`+
			`	.bitmap_mono = {\n`+
			`		.glyphs = ${id}_r${i},\n`+
			`		.width  = ${width},\n`+
			`		.height = ${height},\n`+
			`		.bpp    = ${bpp},\n`+
			`	},\n`+
			`}, `;
	}
	raw += `\n};\nconst size_t ${id}_ranges_len = sizeof(${id}_ranges) / sizeof(pax_font_range_t);\n`;
	
	// Create the font definition.
	var header = '';
	if (split && name) {
		header += 
			`// Generated file, edit at your own risk!\n`+
			`#pragma once\n\n`+
			`extern const pax_font_range_t ${id}_ranges[${fontRanges.length}];\n\n`;
	}
	if (name) {
		header +=
			`// Completed font.\n`+
			`const pax_font_t ${id} = {\n`+
			`	.name         = "${name}",\n`+
			`	.n_ranges     = ${fontRanges.length},\n`+
			`	.ranges       = ${id}_ranges,\n`+
			`	.default_size = ${height},\n`+
			`	.recommend_aa = ${bpp > 1 ? "true" : "false"},\n`+
			`};\n\n`;
	}
	
	if (split) {
		return {c: raw, h: header};
	} else {
		return raw + header;
	}
}

// Exports the font as variable pitch.
function exportVariable(id, height, bpp, name, split=true) {
	var raw = '// Generated file, edit at your own risk!\n#include <pax_fonts.h>\n\n// Raw data.\n';
	
	// Start with outputting some ranges.
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		var indices = [];
		
		// Create some byte arrays.
		var bytes = [];
		for (var glyph = range.start; glyph <= range.end; glyph++) {
			var data = glyphs[glyph];
			indices = indices.concat(bytes.length);
			if (data.visible) {
				bytes = bytes.concat(glyphToBytes(data.bounds.width, data.bounds.height, data.data, bpp));
			}
		}
		raw += intArrToC('uint8_t', `${id}_r${i}`, bytes);
		
		// Then create the dimensions arrays.
		raw += `const pax_bmpv_t ${id}_r${i}_dims[] = {\n`;
		for (var glyph = range.start; glyph <= range.end; glyph++) {
			var data = glyphs[glyph];
			if (data.visible) {
			raw +=
				`{\n`+
				`	.draw_x         = ${data.bounds.x},\n`+
				`	.draw_y         = ${data.bounds.y},\n`+
				`	.draw_w         = ${data.bounds.width},\n`+
				`	.draw_h         = ${data.bounds.height},\n`+
				`	.measured_width = ${data.width},\n`+
				`	.index          = ${indices[glyph-range.start]},\n`+
				`}, `;
			} else {
			raw +=
				`{\n`+
				`	.draw_x         = 0,\n`+
				`	.draw_y         = 0,\n`+
				`	.draw_w         = 0,\n`+
				`	.draw_h         = 0,\n`+
				`	.measured_width = ${data.width},\n`+
				`	.index          = ${indices[glyph-range.start]},\n`+
				`}, `;
			}
		}
		raw += `\n};\n`;
	}
	
	// Create the combining parts.
	raw += `// Combined ranges.\nconst pax_font_range_t ${id}_ranges[${fontRanges.length}] = {\n`;
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		raw +=
			`{ // Range ${i+1} / ${fontRanges.length}.\n`+
			`	.type  = PAX_FONT_TYPE_BITMAP_VAR,\n`+
			`	.start = 0x${range.start.toString(16)},\n`+
			`	.end   = 0x${range.end.toString(16)},\n`+
			`	.bitmap_var = {\n`+
			`		.glyphs = ${id}_r${i},\n`+
			`		.dims   = ${id}_r${i}_dims,\n`+
			`		.height = ${height},\n`+
			`		.bpp    = ${bpp},\n`+
			`	},\n`+
			`}, `;
	}
	raw += `\n};\nconst size_t ${id}_ranges_len = ${fontRanges.length};\n\n`;
	
	// Create the font definition.
	var header = '';
	if (split && name) {
		header += 
			`// Generated file, edit at your own risk!\n`+
			`#pragma once\n\n`+
			`extern const pax_font_range_t ${id}_ranges[${fontRanges.length}];\n\n`;
	}
	if (name) {
		header +=
			`// Completed font.\n`+
			`const pax_font_t ${id} = {\n`+
			`	.name         = "${name}",\n`+
			`	.n_ranges     = ${fontRanges.length},\n`+
			`	.ranges       = ${id}_ranges,\n`+
			`	.default_size = ${height},\n`+
			`	.recommend_aa = ${bpp > 1 ? "true" : "false"},\n`+
			`};\n\n`;
	}
	
	if (split) {
		return {c: raw, h: header};
	} else {
		return raw + header;
	}
}

// Converts the font's name to a C identifier.
function convertName(raw) {
	return raw.replace(/[^\w]/g, "").toLowerCase();
}

// Appends a number with a given amount of bytes to an array.
function appendRawNumber(to, number, bytes) {
	for (; bytes > 0; bytes --) {
		to[to.length] = number & 255;
		number >>= 8;
	}
}

// Appends a string in its bytes form to an array.
function appendString(to, string, withTerm=false) {
	for (var i = 0; i < string.length; i++) {
		to[to.length] = string.charCodeAt(i);
	}
	if (withTerm) {
		to[to.length] = 0;
	}
}

// Exports the font as a PAX font file.
function exportFontFile(height, bpp, name="A font", monospace=false) {
	let antialiasing    = bpp > 1;
	
	var raw = [];
	
	var rangeDims       = [];
	var rangeBitmaps    = [];
	
	var totalBitmapSize = 0;
	var totalDims       = 0;
	
	var monoWidth       = glyphs[fontGlyphs[0]].width;
	
	// Start with preprocessing some ranges.
	if (monospace) {
		for (var i = 0; i < fontRanges.length; i++) {
			var range = fontRanges[i];
			
			// Create some byte arrays.
			var bytes = [];
			for (var glyph = range.start; glyph <= range.end; glyph++) {
				var data = glyphs[glyph];
				bytes = bytes.concat(monoGlyphToBytes(monoWidth, height, data.bounds, data.data, bpp));
			}
			rangeBitmaps[i]  = bytes;
			totalBitmapSize += bytes.length;
		}
	} else {
		for (var i = 0; i < fontRanges.length; i++) {
			var range = fontRanges[i];
			var indices = [];
			
			// Create some byte arrays.
			var bytes = [];
			for (var glyph = range.start; glyph <= range.end; glyph++) {
				var data = glyphs[glyph];
				indices = indices.concat(bytes.length);
				if (data.visible) {
					bytes = bytes.concat(glyphToBytes(data.bounds.width, data.bounds.height, data.data, bpp));
				}
			}
			rangeBitmaps[i]  = bytes;
			totalBitmapSize += bytes.length;
			
			// Then create the dimensions arrays.
			rangeDims[i] = [];
			for (var glyph = range.start; glyph <= range.end; glyph++) {
				var data = glyphs[glyph];
				var dims;
				if (data.visible) {
					dims = {
						draw_x:         data.bounds.x,
						draw_y:         data.bounds.y,
						draw_w:         data.bounds.width,
						draw_h:         data.bounds.height,
						measured_width: data.width,
						index:          indices[glyph-range.start],
					};
				} else {
					dims = {
						draw_x:         0,
						draw_y:         0,
						draw_w:         0,
						draw_h:         0,
						measured_width: data.width,
						index:          indices[glyph-range.start],
					};
				}
				rangeDims[i][glyph-range.start] = dims;
			}
			totalDims += rangeDims[i].length;
		}
	}
	
	/* ==== MAGIC BYTES ==== */
	appendString(raw, "pax_font_t", true);
	
	/* ==== PLATFORM METADATA ==== */
	// Font loader version.
	appendRawNumber(raw, 1, 2);
	
	/* ==== FONT METADATA ==== */
	// Total number of pax_bmpv_t.
	appendRawNumber(raw, totalDims,         8);
	// Total size of the bitmap data.
	appendRawNumber(raw, totalBitmapSize,   8);
	// Length excluding null terminator of the name.
	appendRawNumber(raw, name.length,       8);
	// Number of ranges in the font.
	appendRawNumber(raw, fontRanges.length, 8);
	// Default size of the font in pixels.
	appendRawNumber(raw, height,            2);
	// Whether antialiasing is recommended.
	appendRawNumber(raw, +!!antialiasing,   1)
	
	/* ==== RANGE DATA ==== */
	for (var i = 0; i < fontRanges.length; i++) {
		var range = fontRanges[i];
		
		// Range type.
		appendRawNumber(raw, +!monospace, 1);
		// Range start.
		appendRawNumber(raw, range.start, 4);
		// Range end.
		appendRawNumber(raw, range.end,   4);
		if (monospace) {
			// Monospace range width.
			appendRawNumber(raw, monoWidth, 1);
		}
		// Range height.
		appendRawNumber(raw, height,      1);
		// Range bit per pixel.
		appendRawNumber(raw, bpp,         1);
		
		if (!monospace) {
			// Variable pitch range bitmap dimensions.
			for (var x = 0; x < rangeDims[i].length; x++) {
				var bmpv = rangeDims[i][x];
				
				// Bitmap draw X offset.
				appendRawNumber(raw, bmpv.draw_x,         1);
				// Bitmap draw Y offset.
				appendRawNumber(raw, bmpv.draw_y,         1);
				// Bitmap drawn width.
				appendRawNumber(raw, bmpv.draw_w,         1);
				// Bitmap drawn height.
				appendRawNumber(raw, bmpv.draw_h,         1);
				// Bitmap measured width.
				appendRawNumber(raw, bmpv.measured_width, 1);
				// Bitmap data index.
				appendRawNumber(raw, bmpv.index,          8);
			}
		}
	}
	
	/* ==== RAW DATA ==== */
	// Write bitmap data.
	for (var i = 0; i < fontRanges.length; i++) {
		raw = raw.concat(rangeBitmaps[i]);
	}
	
	// Write font name.
	appendString(raw, name, true);
	
	return raw;
}
