import * as curve from './curve.js';
import * as field from './field.js';
import * as misc from './draw-misc.js';

const TWO_PI = 2*Math.PI;
const EPS = 0.0000001;

function preCalcValues(ctx) {
    const marginWide = 29.5;
    const marginThin = 14.5;
    const dotRadius = 3;
    const w = ctx.canvas.getBoundingClientRect().width;
    const h = ctx.canvas.getBoundingClientRect().height;
    return {
        ctx, marginWide, marginThin, w, h, dotRadius,
        wScale: (w-marginWide-marginThin)/field.p,
        hScale: (h-marginWide-marginThin)/field.p
    };
}

let timeoutInFlight = null;
function inSeconds(n, func) {
    if (timeoutInFlight) {
        clearTimeout(timeoutInFlight);
    }
    timeoutInFlight = setTimeout(func, n * 1000);
}

/**
 * Given an x,y point in the field Fp return the coordinates transformed for the JS Canvas context
 * (adjusted for top-left origin and half-pixel anti-aliasing)
 *
 * @param vals {Object} values from preCalcValues(ctx)
 * @param x {Number} between 0 and p
 * @param y {Number} between 0 and p
 * @return {Number[2]} x,y values transformed for canvas context
 */
function pointToCtx(vals, x, y) {
    return [vals.marginWide+x*vals.wScale, vals.h - (vals.marginWide+y*vals.hScale)];
}

let drawGreyLines = (ctx, vals) => {
    // draw the grey lines
    const greyWidth = 5;
    ctx.strokeStyle = 'lightgrey';
    [field.p/2, field.p].forEach(y => {
        ctx.setLineDash([]);
        ctx.beginPath();
        if (y !== field.p) {
            ctx.setLineDash([2, 2]);
        }
        ctx.moveTo(...pointToCtx(vals, 0, y));
        ctx.lineTo(...pointToCtx(vals, field.p-1, y));
        ctx.stroke();
    });
    for (let i = greyWidth; i < field.p; i += greyWidth) {
        ctx.setLineDash([]);
        ctx.beginPath();
        if (i % 10 !== 0) {
            ctx.setLineDash([2, 2]);
        }
        ctx.moveTo(...pointToCtx(vals, i, 0));
        ctx.lineTo(...pointToCtx(vals, i, field.p));
        ctx.stroke();
    }
};

let drawAxisLines = (ctx, vals) => {
    // draw the axis lines
    ctx.beginPath();
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'black';
    ctx.moveTo(...pointToCtx(vals, 0, 0));
    ctx.lineTo(...pointToCtx(vals, field.p - 0.5, 0));
    ctx.stroke();
    ctx.moveTo(...pointToCtx(vals, 0, 0));
    ctx.lineTo(...pointToCtx(vals, 0, field.p - 0.5));
    ctx.stroke();
    ctx.font = 'italic 12px serif';
    const bodge = 1.6;
    ctx.fillText('0', ...pointToCtx(vals, -bodge, -bodge));
    ctx.fillText('p', ...pointToCtx(vals, -bodge, field.p - 0.5));
    ctx.fillText('p/2', ...pointToCtx(vals, -1.5*bodge, field.p/2 - 0.5));
    ctx.fillText('p', ...pointToCtx(vals, field.p - 0.5, -bodge));
    [10, 20, 30, 40, 50].forEach(x => {
        ctx.fillText(x, ...pointToCtx(vals, x-1, -bodge));
    });
};

let drawArrowHeads = (ctx, vals) => {
    // draw the arrows
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
    const arrLen = 10;
    const arrWid = 5;
    const xHead = pointToCtx(vals, field.p, 0);
    ctx.beginPath();
    ctx.moveTo(...xHead);
    ctx.lineTo(...[xHead[0]-arrLen, xHead[1]-arrWid]);
    ctx.lineTo(...[xHead[0]-arrLen/2, xHead[1]]);
    ctx.lineTo(...[xHead[0]-arrLen, xHead[1]+arrWid]);
    ctx.closePath();
    ctx.fill();

    const yHead = pointToCtx(vals, 0, field.p);
    ctx.beginPath();
    ctx.moveTo(...yHead);
    ctx.lineTo(...[yHead[0]-arrWid, yHead[1]+arrLen]);
    ctx.lineTo(...[yHead[0], yHead[1]+arrLen/2]);
    ctx.lineTo(...[yHead[0]+arrWid, yHead[1]+arrLen]);
    ctx.closePath();
    ctx.fill();
};

let resetSaveState = null;

async function resetGraph(ctx) {
    if (animationFrameInProgress) {
        cancelAnimationFrame(animationFrameInProgress);
    }
    if (timeoutInFlight) {
        clearTimeout(timeoutInFlight);
    }
    return new Promise(success => {
        const canvas = ctx.canvas;
        if (resetSaveState) {
            const ratio = canvas._ratio || 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const img = resetSaveState;
            ctx.drawImage(img, 0, 0, img.width, img.height,
                0, 0, canvas.width / ratio, canvas.height / ratio);
            success({'usedCache': true});
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid(ctx);
            drawCurve(ctx);
            canvas.toBlob(blob => {
                let img = new Image();
                img.addEventListener('load', () => {
                    resetSaveState = img;
                });
                img.src = URL.createObjectURL(blob);
            }, 'image/png');
            success({'usedCache': false});
        }
    });
}

/**
 * Draw a grid for Fp in the given 2d canvas context.
 *
 * @param ctx {CanvasRenderingContext2D}
 */
function drawGrid(ctx) {
    const vals = preCalcValues(ctx);
    ctx.lineWidth = 1;

    drawGreyLines(ctx, vals);
    drawAxisLines(ctx, vals);
    drawArrowHeads(ctx, vals);
}

/**
 * @param vals {Object} return from cacheVals
 * @param x {Number} coordinate
 * @param y {Number} coordinate
 * @param color {String} fill style
 * @param radius {Number?} dot radius
 * @param lineWidth {Number?} line width
 */
function drawDot(vals, x, y, color, radius, lineWidth) {
    const ctx = vals.ctx;
    ctx.beginPath();
    ctx.save();
    ctx.strokeStyle = 'black';
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth || 1;
    ctx.moveTo(...pointToCtx(vals, x, y));
    ctx.arc(...pointToCtx(vals, x, y), radius || vals.dotRadius, 0, TWO_PI);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
}

/**
 * Draw the curve in the given 2d canvas context.
 *
 * @param ctx {CanvasRenderingContext2D}
 */
function drawCurve(ctx) {
    const vals = preCalcValues(ctx);
    const origFill = ctx.fillStyle;
    ctx.fillStyle = 'lightblue';
    for (let x = 0; x < field.p; x++) {
        let yVals = curve.Y(x);
        if (yVals) {
            drawDot(vals, x, yVals[0], 'lightblue');
            drawDot(vals, x, yVals[1], 'lightblue');
        }
    }
    ctx.fillStyle = 'black';
    let P = curve.P();
    drawDot(vals, P.x, P.y, 'black', vals.dotRadius);
    ctx.fillStyle = origFill;
}

let animationFrameInProgress;

/**
 * @param ctx {CanvasRenderingContext2D}
 * @param Q {Point} the current point 'Q', to which 'P' will be added
 * @param drawDoneCb {Function?} optional callback when done drawing
 */
async function addP(ctx, Q, drawDoneCb) {
    if (animationFrameInProgress) {
        await resetGraph(ctx);
    }
    const vals = preCalcValues(ctx);
    let start, prev;

    const P = curve.P();
    if (!Q) {
        Q = P;
    }
    const R = curve.pointAdd(P, Q);
    const negR = curve.negate(R);

    const started = {};
    const finished = {};
    const duration = {
        tangent: 500,
        tanPause: 300,
        line: 500,
        linePause: 300,
        negate: 1000,
        done: 1000,
    };
    const slope = misc.getSlope(P, Q);
    const cache = {};

    drawDot(vals, Q.x, Q.y, 'red');

    async function step(timestamp) {
        if (!start) {
            start = timestamp;
        }
        let elapsed = timestamp - start;
        if (timestamp !== prev) {
            ctx.save();
            if (!finished['tangent']) {
                started.tangent = started.tangent || timestamp;
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'orange';
                ctx.setLineDash([4, 4]);
                let mult = elapsed / duration.tangent;
                mult = misc.easeInOut(mult);
                let bounds = misc.lineBoxBounds(P, Q);
                let tanLineForw = bounds[1] - Q.x;
                let tanLineBack = Q.x - bounds[0];
                tanLineForw *= mult;
                tanLineBack *= mult;
                ctx.moveTo(...pointToCtx(vals, Q.x, Q.y));
                ctx.lineTo(...pointToCtx(vals, Q.x + Math.abs(tanLineForw),
                    Q.y + tanLineForw * slope));
                ctx.moveTo(...pointToCtx(vals, Q.x, Q.y));
                ctx.lineTo(...pointToCtx(vals, Q.x - Math.abs(tanLineBack),
                    Q.y - tanLineBack * slope));
                ctx.stroke();
                drawDot(vals, P.x, P.y, 'black');
                drawDot(vals, Q.x, Q.y, 'red');
                if (elapsed > duration.tangent) {
                    finished.tangent = timestamp;
                }
            } else if (!finished.tanPause) {
                started.tanPause = started.tanPause || timestamp;
                if (timestamp - started.tanPause > duration.tanPause) {
                    finished.tanPause = timestamp;
                }
            } else if (!finished.line) {
                started.line = started.line || timestamp;
                if (!cache.lineLastP) {
                    let _x;
                    // noinspection JSUnusedAssignment
                    [cache.lineLastP, _x] = misc.orderPointsByX(P, Q);
                    cache.lineXLeft = misc.findTotalXLength(P, Q, negR);
                    cache.lineXPerMs = cache.lineXLeft / duration.line || 1;
                    cache.segmentBudget = 5;
                }

                ctx.lineWidth = 2;
                ctx.strokeStyle = 'orange';
                ctx.setLineDash([]);
                let todoX = Math.min(cache.lineXPerMs * (timestamp - prev), cache.lineXLeft);
                let check = 10;
                let segmentsLen = 0;
                while (todoX > 0 && segmentsLen < cache.segmentBudget) {
                    if (check-- < 0) break;
                    ctx.beginPath();
                    ctx.moveTo(...pointToCtx(vals, cache.lineLastP.x, cache.lineLastP.y));
                    let next = misc.findWrapSegment(cache.lineLastP, slope, todoX,
                        cache.segmentBudget - segmentsLen);
                    ctx.lineTo(...pointToCtx(vals, next.x, next.y));
                    ctx.stroke();
                    segmentsLen += misc.segmentLen(cache.lineLastP, next);

                    let drawnX = next.x - cache.lineLastP.x;
                    if (next.y < EPS) {
                        next.y += field.p;
                        cache.segmentBudget *= 1.1;
                    } else if (next.y > field.p - EPS) {
                        next.y -= field.p;
                        cache.segmentBudget *= 1.1;
                    }
                    if (next.x > field.p - EPS) {
                        next.x -= field.p;
                        cache.segmentBudget *= 1.1;
                    }
                    cache.lineLastP = next;
                    cache.lineXLeft -= drawnX;
                    todoX -= drawnX;
                }
                drawDot(vals, P.x, P.y, 'black');
                drawDot(vals, Q.x, Q.y, 'red');
                if (cache.lineXLeft <= EPS) {
                    finished.line = timestamp;
                    drawDot(vals, negR.x, negR.y, 'orange');
                }
            } else if (!finished.linePause) {
                started.linePause = started.linePause || timestamp;
                if (timestamp - started.linePause >= duration.linePause) {
                    finished.linePause = timestamp;
                }
            } else if (!finished.negate) {
                started.negate = started.negate || timestamp;
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'red';
                ctx.setLineDash([3, 2]);
                if (!cache.negateLength) {
                    cache.negateLength = curve.negate(R).y - R.y;
                }
                let mult = (timestamp - started.negate) / duration.negate;
                mult = Math.min(1, mult);
                mult = misc.easeInOut(mult);
                ctx.moveTo(...pointToCtx(vals, negR.x, negR.y));
                ctx.lineTo(...pointToCtx(vals, negR.x, negR.y - cache.negateLength * mult));
                ctx.stroke();
                ctx.setLineDash([]);
                // overdraw to fix red line covering this dot
                drawDot(vals, negR.x, negR.y, 'orange');
                if (mult === 1.0) {
                    ctx.strokeStyle = 'black';
                    drawDot(vals, R.x, R.y, 'red', vals.dotRadius + 1, 2);
                    finished.negate = timestamp;
                }
            } else if (!finished.done) {
                started.done = started.done || timestamp;
                if (timestamp - started.done > duration.done) {
                    finished.done = timestamp;
                }
            }
            ctx.restore();
        }
        prev = timestamp;

        if (finished.done) {
            await resetGraph(ctx);
            ctx.save();
            drawDot(vals, R.x, R.y, 'red');
            ctx.restore();
            if (drawDoneCb) {
                drawDoneCb(R);
            }
        } else {
            animationFrameInProgress = requestAnimationFrame(step);
        }
    }
    if (animationFrameInProgress) {
        cancelAnimationFrame(animationFrameInProgress);
    }
    animationFrameInProgress = requestAnimationFrame(step);
    return R;
}

export {
    inSeconds,
    resetGraph,
    addP,
};
