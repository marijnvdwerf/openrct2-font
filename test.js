const fs = require('fs');
const path = require('path');
const glob = require('glob');
const svg2png = require("svg2png");
const imageDiff = require('image-diff');
const tmp = require('tmp');

const assert = require('assert');

var phantomjs = require('phantomjs');
var Pool = require('phantomjs-pool').Pool;

var pool = new Pool({ // create a pool
    numWorkers: 2,   // with 4 workers
    jobCallback: jobCallback,
    workerFile: __dirname + '/test-worker.js', // location of the worker file
});

const srcPath = path.resolve(__dirname, 'src');
const specPath = path.resolve(__dirname, 'spec', 'reference-rendering');

const codePointRegex = /^(([\dA-Fa-f]{4})(\-[\dA-Fa-f]{4})*)$/;


var folders = fs.readdirSync(specPath).filter(function (file) {
    return fs.statSync(path.resolve(specPath, file)).isDirectory();
});

var jobs = [];

folders.some(function (folder) {
    suite(folder, function () {
        var filenames = fs
            .readdirSync(path.resolve(specPath, folder))
            .filter(function (file) {
                return path.extname(file) === '.png';
            })
            .filter(function (file) {
                return codePointRegex.test(path.basename(file, '.png'));
            });

        var svgPath = path.resolve(srcPath, folder);

        filenames.some(function (filename) {
            var basename = path.basename(filename, '.png');
            var data = codePointRegex.exec(basename);
            var charCodes = data[0].split('-').map(function (code) {
                return parseInt(code, 16);
            });

            var char = charCodes.map(function (code) {
                return String.fromCharCode(code);
            }).join('');

            test(char + " (" + basename + ")", function () {

                var specFilePath = path.resolve(specPath, folder, filename);

                var svgFilePath = glob(svgPath + "/" + basename + "?(_*).svg", {sync: true});
                if (svgFilePath.length === 0) {
                    assert.equal(svgFilePath.length, 1, "No svg found for U+" + charCodes.toString(16) + " (" + char + ")");
                    return;
                } else if (svgFilePath.length > 1) {
                    throw new assert.AssertionError({message: "Multiple svg files found for U+" + charCodes.toString(16) + " (" + char + ")"});
                }
                svgFilePath = svgFilePath[0];

                pushJob({
                    path: svgFilePath,
                    callback: function (tmpRender) {

                        var tmpDiff = tmp.fileSync();
                        imageDiff({
                            actualImage: tmpRender.name,
                            expectedImage: specFilePath,
                            diffImage: basename + '-diff.png'
                        }, function (err, imagesAreSame) {
                            if (err) {
                                console.error(err);
                            }

                            assert.equal(imagesAreSame, true, "Images should be the same");
                            if (!imagesAreSame) {
                                fs.createReadStream(tmpRender.name).pipe(fs.createWriteStream(basename + '-render.png'));
                                console.error(basename + "is different");
                            } else {
                                fs.unlinkSync(basename + '-diff.png');
                            }

                            tmpRender.removeCallback();
                            tmpDiff.removeCallback();
                        });
                    }
                });
            });
        });
    });
});

function pushJob(job) {
    jobs.push(job);
    if (jobs.length === 1) {
        pool.start();
    }
}

function jobCallback(job, worker, index) {
    if (jobs.length === 0) {
        job(null);
        return;
    }

    var jobData = jobs.shift();
    var outputFile = tmp.fileSync({postfix: '.png'});

    job({
        sourceBase64: fs.readFileSync(jobData.path).toString('base64'),
        outputPath: outputFile.name
    }, function (err, data) {
        if (err !== null) {
            console.error(err.message);
            return;
        }

        jobData.callback(outputFile);
    });
}


