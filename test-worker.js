var webpage = require('webpage');

module.exports = function (data, done, worker) { // data provided by the master
    var page = webpage.create();

    // search for the given data (which contains the index number) and save a screenshot
    page.open('data:image/svg+xml;base64,' + data.sourceBase64, function (status) {

        page.evaluate(function () {
            /* global document: true */

            var el = document.documentElement;

            if (el.hasAttribute('width') || el.hasAttribute('height')) {
                return;
            }

            var viewBoxWidth = el.viewBox.animVal.width;
            var viewBoxHeight = el.viewBox.animVal.height;

            el.setAttribute('width', viewBoxWidth + 'px');
            el.setAttribute('height', viewBoxHeight + 'px');
        });

        page.render(data.outputPath);
        done(); // signal that the job was executed
    });

};
