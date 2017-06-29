const isArray = arr => Object.prototype.toString.call(arr) === '[object Array]';

const fuzzy = {
    /**
     * Tests if a string matches a pattern
     * @param  {String}  q             The pattern
     * @param  {String}  str           The string
     * @param  {Boolean} caseSensitive True if case sensitive should count
     * @return {Boolean} True if the string matches, false otherwise
     */
    test(q, str, caseSensitive = false) {
        if (typeof q !== 'string' || typeof str !== 'string') {
            return -1;
        }

        if (!str) {
            return -1;
        }

        if (!q) {
            return true;
        }

        if (!caseSensitive) {
            q   = q.toLowerCase();
            str = str.toLowerCase();
        }

        let pos = 0;
        let i   = 0;

        while (i < str.length) {

            if (str[i] === q[pos]) {
                pos += 1;
            }

            ++i;
        }

        return pos === q.length;
    },

    /**
     * Tests if a string matches a pattern and return a score
     * @param  {String} q    The pattern
     * @param  {String} str  The string
     * @param  {Object} opts Options containing `caseSensitive` `before` and `after`
     * @return {Object} Object containing score and surrounded (or intact) result
     */
    match(q, str, opts) {
        if (typeof q !== 'string' || typeof str !== 'string') {
            return { score: 0, result: str };
        }

        if (!str) {
            return { score: 0, result: str };
        }

        if (!q) {
            return { score: 1, result: str };
        }

        // Keep original str for case
        let originalStr = str;

        opts = Object.assign({
            caseSensitive: false,
            before       : '',
            after        : ''
        }, opts);

        if (!opts.caseSensitive) {
            q   = q.toLowerCase();
            str = str.toLowerCase();
        }

        // String with surrounded results
        let result = '';

        // Number of spaces between matches
        let steps = 0;

        // Actual pattern position
        let pos = 0;

        // Last match position
        let lastI = 0;

        let i = 0;
        while (i < str.length) {
            const c = str[i];

            if (c === q[pos]) {
                result += opts.before + originalStr[i] + opts.after;

                // Move to the next pattern character
                pos += 1;

                // Add spaces between the last match to steps
                steps += (i - lastI);

                // Reset counter to the actual position in string
                lastI = i;
            } else {
                result += originalStr[i];
            }

            ++i;
        }

        if (pos === q.length) {
            // Score between 0 and 1 calculated by the number of spaces
            // between letters and the string length.
            // The biggest the score is the better
            const score = q.length / (steps + 1);

            return { score, result };
        }

        return { score: 0, result: str };
    },

    /**
     * Filters an array based on the pattern
     * @param  {String}        q    The pattern
     * @param  {Array<String>} set  An array of queries
     * @param  {Object}        opts Options containing `caseSensitive` `before` and `after`
     * @return {Array<String>} A sorted array of results
     */
    filter(q, set, opts) {
        if (!isArray(set)) {
            return [];
        }

        if (typeof q !== 'string' || !q) {
            return set;
        }

        opts = Object.assign({
            caseSensitive: false,
            before       : '',
            after        : ''
        }, opts);

        const results = [];

        let i = 0;
        while (i < set.length) {
            const str    = set[i];
            const result = fuzzy.match(q, str, opts);

            if (result.score > 0) {
                results.push(result);
            }

            ++i;
        }

        return results
            .sort((a, b) => b.score - a.score)
            .map(elem => elem.result)
    }
};