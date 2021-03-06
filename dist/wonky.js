/* wonky.js
 *
 * Random distribution sampling in JavaScript
 *
 * Probably a bad idea.
 *
 */



// Statistical functions
Stat = (function(){

    // arithmetic mean
    var mean = function(sample) {
        var sum = sample.reduce(function(a,b){ return a + b  });
        return sum / sample.length;
    }

    // standard deviation
    var sd = function(sample) {
        var x_bar = mean(sample);
        var squareDiffs = sample.map(function(x){return Math.pow(x - x_bar,2)});
        return Math.sqrt(mean(squareDiffs));
    }

    // to_n
    // returns an array of integers [1..n]
    // One day we'll get proper range generators in JavaScript
    var to_n = function(n) {
        if(n < 1) {
            return [];
        }
        return Array.apply(0, Array(n)).map(function(c,i,a){
            return i + 1;
        });
    }

    // Recursive factorial function with memoization
    var fact_cache = [1, 1];
    var fact = function(n) {
        if(n == 0 || n == 1) {
            return 1;
        }

        if (typeof fact_cache[n] !== 'undefined') {
            return fact_cache[n];
        }

        return fact_cache[n] = fact(n - 1) * n;
    }

    // Binomial coefficient
    var choose = function(n, k) {
        return fact(n) / (fact(k) * fact(n - k));
    }

    // Lanczos approximation (g=7, n=9) for the Gamma function
    // Should be precise enough for most JavaScript float purposes
    var gamma = function(z) {
        var c = [
            0.99999999999980993,
            676.5203681218851,
            -1259.1392167224028,
            771.32342877765313,
            -176.61502916214059,
            12.507343278686905,
            -0.13857109526572012,
            9.9843695780195716e-6,
            1.5056327351493116e-7
            ];
        g = 7;
        if(z < 0.5) {
            return Math.PI / (Math.sin(Math.PI * z) * gamma (1 - z));
        } else {
            z--;
            var s = c[0];
            to_n(8).forEach(function(i, j, a) {
                s += c[i] / (z + i);
            });

            var t = z + g + 0.5;
            return Math.sqrt(2 * Math.PI)*Math.pow(t, z + 0.5)*Math.exp(-t)*s;
        }
    }



    // Exposed methods
    return {
        mean    : mean,
        sd      : sd,
        fact    : fact,
        choose  : choose,
        gamma   : gamma,
        to_n    : to_n  // might not keep this exposed
    }
})();

// Distributions
Dist = (function(){

    // General sampling algorithm for sample size n
    var sampler = function(n, prob, support) {
        var sample = [];
        //var wastage = 0;
        while(sample.length < n) {
            var candidate = support(Math.random());
            //console.log(candidate, prob(candidate));
            if(Math.random() <= prob(candidate)) {
                sample.push(candidate);
            } //else { wastage++; }
        }
        // console.log("Wastage: ", wastage/n);
        return sample;
    }

    var distributionFactory = function(name, prob, support) {

        return {
            name    : name,
            sample  : function(n) {
                return sampler(n, prob, support);
            }
        }
    }

    // Support closures
    // Standardised templates that map U(0,1) to a wide confidence interval
    // for the support of a distribution

    var symmetricContinuousRange = function(mean, spread) {
        // e.g. (-inf, inf)
        // `spread` should be roughly one standard deviation or equivalent
        return function(u) {
            return ( ( ( u * 2  ) - 1  ) * spread * 5.5 ) + mean;
        }
    }

    var naturalNumbers = function(height) {
        // y <- {0, 1...height}
        // `height` should cover the bulk of the probability mass
        return function(u) {
            return Math.floor(u * height);
        }
    }

    // positive reals
    var r_plus = function(height) {
        // [1, inf)
        return function(u) {
            return (u * height) + 1;
        }
    }

    // positive reals plus zero
    var r_plus_zero = function(height) {
        // [0, inf)
        return function(u) {
            return (u * height);
        }
    }

    // U(0, 1) continuous (a bit silly)
    var u_0_1 = function() {
        return function(u) {
            return u;
        }
    }

    // Object containing probability density/mass function,
    // support, help and aliases for distributions
    var distributions = {
        normal  : {
            definition  : function(mu, sigsq) {
                var pdf = function(x) {
                    var normconst = (1/(Math.sqrt(sigsq * 2 * Math.PI)));
                    var core = Math.exp((-1/2) * Math.pow(((x - mu)/Math.sqrt(sigsq)),2));
                    return normconst * core;
                }
                var support = symmetricContinuousRange(mu, Math.sqrt(sigsq));

                return {
                    name: "Normal",
                    probFunc: pdf,
                    support: support
                }
            },
            help    : "Normal distribution N(mean, variance)",
            aliases : ['N'],
        },
        poisson : {
            definition  : function(lambda) {
                var pmf = function(x) {
                    return (Math.exp(-lambda) * Math.pow(lambda, x)) / Stat.fact(x);
                }
                var support = naturalNumbers(lambda * 4);

                return {
                    name: "poisson",
                    probFunc: pmf,
                    support: support
                }
            },
            help    : "Poisson distribution Poisson(lambda)",
            aliases : ['Poisson'],
        },
        binomial : {
            definition: function(n, p) {
                var pmf = function(x) {
                    return Stat.choose(n, x) * Math.pow(p, x) * Math.pow(1 - p, n - x);
                }
                var support = naturalNumbers(n);

                return {
                    name: "binomial",
                    probFunc: pmf,
                    support: support
                }
            },
            help    : "Binomial distribution B(n, p)",
            aliases : ['B']
        },
        beta    : {
            definition: function(a, b) {
                var pdf = function(x) {
                    var constant = Stat.gamma(a + b) / (Stat.gamma(a) * Stat.gamma(b));
                    var core = Math.pow(x, a - 1) * Math.pow(1 - x, b - 1);
                    return constant * core;
                }
                var support = u_0_1();

                return {
                    name: "beta",
                    probFunc: pdf,
                    support: support
                }
            },
            help    : "Beta distribution Beta(a, b)",
            aliases : ['Beta']
        },
        gamma   : {
            definition: function(alpha, beta) {
                var pdf = function(x) {
                    var constant = Math.pow(beta, alpha) / Stat.gamma(alpha);
                    var core = Math.pow(x, alpha - 1) * Math.exp(-beta * x);
                    return constant * core;
                }
                // Something about this support function is non-performant
                var support = r_plus_zero((5 * alpha)/(beta * beta));

                return {
                    name: "gamma",
                    probFunc: pdf,
                    support: support
                }
            },
            help    : "Gamma distribution Gamma(alpha, beta)",
            aliases : ["Gamma"]
        },
        exponential : {
            definition: function(lambda) {
                var pdf = function(x) {
                    return lambda * Math.exp(-lambda * x);
                }
                var support = r_plus_zero(5 * (1 / lambda));

                return {
                    name: "exponential",
                    probFunc: pdf,
                    support: support
                }
            },
            help    : "Exponential distribution M(lambda)",
            aliases : ["M"]
        }
    }

    var help = {};
    var exposed_methods = {
        help    :   function(dist) {
                        return help[dist];
                    }
    };

    // TODO: t, Laplace, geometric
    // Inject all distributions into exposed methods
    for (var d in distributions) {
        // Factory-calling closure
        var factory = function(distribution){
            return function(args) {
                var parts = distribution.definition.apply(undefined, arguments);
                return distributionFactory(parts.name, parts.probFunc, parts.support);
                }
        };

        var aliases = distributions[d].aliases;
        exposed_methods[d] = factory(distributions[d]);
        for (var a in aliases) {
            exposed_methods[aliases[a]] = factory(distributions[d]);
        }

        help[d] = distributions[d].help;
    }
    return exposed_methods;
})();
