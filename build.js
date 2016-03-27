const fs = require('fs');
const path = require('path');
const libxmljs = require('libxmljs');
const SVGPathData = require('svg-pathdata');
const _ = require('lodash');
const svg2ttf = require('svg2ttf');
const ttf2woff = require('ttf2woff');

const srcRoot = './src';

var outDocument = new libxmljs.Document();
var outSvg = outDocument.node('svg').attr({
    version: "1.1",
    xmlns: 'http://www.w3.org/2000/svg'
});

var folders = fs.readdirSync(srcRoot).filter(function (file) {
    return fs.statSync(path.resolve(__dirname, srcRoot, file)).isDirectory();
});

folders.forEach(function (folder) {
    var settings = {
        'font-family': "CoasterSans",
        'font-weight': "normal",
        'font-style': "normal",
        'units-per-em': 12,
        'cap-height': "600",
        'x-height': "6",
        ascent: "9",
        descent: "3",
        alphabetic: "0",
        mathematical: "350",
        ideographic: "400",
        hanging: "500"
    };

    var infoPath = path.resolve(__dirname, srcRoot, folder, '0000.json');
    if (fs.existsSync(infoPath)) {
        settings = _.defaults(require(infoPath), settings);
    }

    var unitsPerEM = settings['units-per-em'];
    var scale = 1;
    while (Math.sqrt(unitsPerEM * scale) % 2) {
        scale++;
    }

    _.forEach(settings, function (value, key) {
        if (_.indexOf(['units-per-em', 'stemv', 'stemh', 'cap-height', 'x-height', 'accent-height', 'ascent', 'descent'], key.toLowerCase()) == -1) {
            return;
        }

        settings[key] = value * scale;
    });

    var outFont = outSvg.node('defs').node('font').attr({id: folder, 'horiz-adv-x': "1000"});
    outFont.node('font-face').attr(settings);
    outFont.node('missing-glyph').node('path').attr({d: "M0,0h200v200h-200z"});

    var filenames = fs.readdirSync(path.resolve(__dirname, srcRoot, folder)).filter(function (file) {
        return path.extname(file) === '.svg';
    });

    filenames.forEach(function (filename) {
        var data = /(-?[\dA-Fa-f]{4})*/.exec(filename);
        if (data === false) {
            return;
        }

        var charCodes = data[0].split('-');
        var char = charCodes.map(function (code) {
            return String.fromCharCode(parseInt(code, 16));
        }).join('');

        var svg = fs.readFileSync(path.resolve(__dirname, srcRoot, folder, filename));
        var svgDom = libxmljs.parseXml(svg);
        width = svgDom.root().attr('viewBox').value().split(' ')[2];

        switch (folder) {
            case 'big':
                width++;
                break;

            case 'japanese':
                break;

            default:
                width--;
                break;
        }

        width *= scale;

        var paths = svgDom.find('//svg:path', {svg: 'http://www.w3.org/2000/svg'});
        if (paths.length === 0) {
            outFont.node('glyph').attr({unicode: char, 'horiz-adv-x': width});
            return;
        } else if (paths.length > 1) {
            console.error(filename + '(' + char + ') contains multiple paths.');
            return;
        }

        var pathElement = paths[0];
        var combinedTransform = {x: 0, y: -(settings.ascent / scale)};

        var pathData = new SVGPathData(pathElement.attr('d').value());

        pathData.commands.forEach(function (el) {
            if (el.x === undefined && el.y === undefined) {
                return;
            }

            if (el.relative) {
                return;
            }

            if (el.x !== undefined) {
                el.x += combinedTransform.x;
            }
            if (el.y !== undefined) {
                el.y += combinedTransform.y;
            }
        });

        pathData.commands.forEach(function (el) {
            if (el.x === undefined && el.y === undefined) {
                return;
            }

            el.y = -el.y;
        });

        pathData.commands.forEach(function (el) {

            if (el.x !== undefined) {
                el.x *= scale;
            }
            if (el.y !== undefined) {
                el.y *= scale;
            }
        });

        outFont.node('glyph').attr({unicode: char, d: pathData.encode(), 'horiz-adv-x': width});
    });


    var ttf = svg2ttf(outDocument.toString());
    var woff = ttf2woff(ttf);

    if (!fs.existsSync('./dist')) {
        fs.mkdirSync('./dist');
    }
    fs.writeFileSync(path.resolve(__dirname, 'dist', 'coastersans-' + folder + '.ttf'), new Buffer(ttf.buffer));
    fs.writeFileSync(path.resolve(__dirname, 'dist', 'coastersans-' + folder + '.woff'), new Buffer(woff.buffer));

    outFont.remove();
});




