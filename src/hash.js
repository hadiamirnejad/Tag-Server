const {createHash} = require('crypto');

function computeSHA256(lines) {
    const hash = createHash('sha256');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        hash.write(line);
    }
    return hash.digest('hex');
}

const createCode = function generateCode(jsonData){
    return computeSHA256(JSON.stringify(jsonData));
};

module.exports.createCode = createCode;