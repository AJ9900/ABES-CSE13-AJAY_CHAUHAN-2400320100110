const display = document.querySelector('#display');
const exprEl = document.querySelector('#expr');
const buttons = document.querySelectorAll('#box button');
const angleModeEl = document.querySelector('#angle-mode');
const precisionEl = document.querySelector('#precision');

let currentInput = '';
let lastResult = '';

function formatResult(v) {
    if (!Number.isFinite(v)) return String(v);
    // use significant digits from precision select
    const sig = parseInt(precisionEl.value || '12', 10);
    // show integers without exponent when possible
    if (Math.abs(Math.round(v) - v) < 1e-12) return String(Math.round(v));
    // otherwise use toPrecision then trim trailing zeros
    let s = Number(v).toPrecision(sig);
    // remove trailing zeros in fractional part
    if (s.indexOf('.') !== -1) s = s.replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
    return s;
}

function factorial(n) {
    n = Math.floor(n);
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function toRadians(x) { return x * Math.PI / 180; }
function fromRadians(x) { return x * 180 / Math.PI; }

// wrappers that respect angle mode
function sin_w(x) { return angleModeEl.value === 'DEG' ? Math.sin(toRadians(x)) : Math.sin(x); }
function cos_w(x) { return angleModeEl.value === 'DEG' ? Math.cos(toRadians(x)) : Math.cos(x); }
function tan_w(x) { return angleModeEl.value === 'DEG' ? Math.tan(toRadians(x)) : Math.tan(x); }
function asin_w(x) { const v = Math.asin(x); return angleModeEl.value === 'DEG' ? fromRadians(v) : v; }
function acos_w(x) { const v = Math.acos(x); return angleModeEl.value === 'DEG' ? fromRadians(v) : v; }
function atan_w(x) { const v = Math.atan(x); return angleModeEl.value === 'DEG' ? fromRadians(v) : v; }

// evaluate expression by mapping tokens to safe functions/values
function evaluateExpression(inputExpr) {
    if (!inputExpr) return '';
    let expr = inputExpr;

    // replace some readable tokens
    expr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'PI').replace(/\be\b/g, 'E');

    // percentage as per calculator: n% -> (n/100)
    expr = expr.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

    // factorial: number! or (expr)! -> fact(...)
    expr = expr.replace(/([0-9.]+|\([^\)]+\))!/g, 'fact($1)');

    // x² and x³ are handled by buttons (they append ^2 / ^3)
    // caret to exponent operator
    expr = expr.replace(/\^/g, '**');

    // map common function names to our wrappers or Math
    // ensure function names followed by ( remain
    expr = expr.replace(/\blog\(/g, 'log10('); // user 'log' -> base10
    expr = expr.replace(/\bln\(/g, 'ln(');
    // prepare context function names: sin,cos,tan,asin,acos,atan,log10,ln,sqrt,exp,abs,fact,PI,E,pow
    // Replace ln( -> ln( (we will provide ln function)
    // Nothing else required here.

    // Build callable function with allowed names
    const contextNames = [
        'sin','cos','tan','asin','acos','atan',
        'sin_w','cos_w','tan_w','asin_w','acos_w','atan_w',
        'log10','ln','sqrt','exp','abs','fact','pow','PI','E'
    ];
    // create safe wrappers mapping to functions
    const context = {
        sin: sin_w, cos: cos_w, tan: tan_w,
        asin: asin_w, acos: acos_w, atan: atan_w,
        log10: (x) => Math.log10(x),
        ln: (x) => Math.log(x),
        sqrt: (x) => Math.sqrt(x),
        exp: (x) => Math.exp(x),
        abs: (x) => Math.abs(x),
        fact: factorial,
        pow: Math.pow,
        PI: Math.PI,
        E: Math.E
    };

    // Some users may use Math.* explicitly; allow Math by mapping
    // To allow ** operator and numeric operations, just evaluate with Function.
    try {
        // Create function with names as parameters in order and return expression
        const paramNames = Object.keys(context);
        const paramValues = paramNames.map(k => context[k]);
        const fn = new Function(...paramNames, '"use strict"; return (' + expr + ');');
        const raw = fn(...paramValues);
        return raw;
    } catch (e) {
        // fall back to NaN on parse/eval error
        return NaN;
    }
}

buttons.forEach(button => {
    button.addEventListener('click', () => {
        const value = button.textContent.trim();

        // special scientific buttons handling
        if (value === 'Ac') {
            currentInput = '';
            display.value = '';
            exprEl.textContent = '';
            return;
        }
        if (value === 'DEL') {
            currentInput = currentInput.slice(0, -1);
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === '=') {
            try {
                const raw = evaluateExpression(currentInput);
                const formatted = formatResult(raw);
                display.value = formatted;
                exprEl.textContent = currentInput + ' =';
                lastResult = formatted;
                currentInput = String(formatted); // allow chaining
            } catch (err) {
                display.value = 'Error';
                currentInput = '';
                exprEl.textContent = '';
            }
            return;
        }

        // scientific function buttons (insert appropriate token)
        if (value === 'sin' || value === 'cos' || value === 'tan' ||
            value === 'asin' || value === 'acos' || value === 'atan' ||
            value === 'ln' || value === 'log' || value === 'exp' || value === 'abs') {
            // ln/log etc append function(  - log mapped to log10 in evaluator
            currentInput += value + '(';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === '√') {
            currentInput += 'sqrt(';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === 'x²') {
            currentInput += '^2';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === 'x³') {
            currentInput += '^3';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === 'x^y') {
            currentInput += '^';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === 'x!') {
            currentInput += '!';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === 'π') {
            currentInput += 'π';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === 'e') {
            currentInput += 'e';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === '1/x') {
            // wrap previous expression as reciprocal
            if (currentInput.length === 0) {
                currentInput = '1/(' + currentInput + ')';
            } else {
                currentInput = '1/(' + currentInput + ')';
            }
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        if (value === '%') {
            // append percent sign (handled in evaluator)
            currentInput += '%';
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        // digits, decimal point, operators
        if (/^[0-9.]$/.test(value) || ['+','-','*','/'].includes(value) || value === '00') {
            currentInput += (value === '00' ? '00' : value);
            display.value = currentInput;
            exprEl.textContent = currentInput;
            return;
        }

        // fallback: append raw text
        currentInput += value;
        display.value = currentInput;
        exprEl.textContent = currentInput;
    });
});

// optional: keyboard support for convenience
window.addEventListener('keydown', (e) => {
    const key = e.key;
    if ((/^[0-9+\-*/().]$/).test(key)) {
        currentInput += key;
        display.value = currentInput;
        exprEl.textContent = currentInput;
    } else if (key === 'Enter') {
        document.querySelector('#equall').click();
    } else if (key === 'Backspace') {
        document.querySelector('.operator:contains("DEL")')?.click();
        // fallback slice:
        currentInput = currentInput.slice(0, -1);
        display.value = currentInput;
        exprEl.textContent = currentInput;
    }
});