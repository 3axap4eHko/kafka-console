import vm from 'vm';
import * as Formatters from '../formatters';

describe('Formatters test suite', () => {
    it.each([
        ['js'],
        ['json'],
    ])('Should export %s formatter', (type: Formatters.Format) => {
        expect(Formatters).toHaveProperty(type);
    });

    it('JSON formatter should encode via JSON object', () => {
        const data = {};
        const stringify = jest.spyOn(JSON, 'stringify');
        Formatters.json.encode(data);
        expect(stringify).toHaveBeenCalledWith(data);
        stringify.mockRestore();
    });

    it('JSON formatter should decode via JSON object', () => {
        const json = Buffer.from('{}');
        const parse = jest.spyOn(JSON, 'parse');
        const result = Formatters.json.decode(json);
        expect(result).toEqual({});
        expect(parse).toHaveBeenCalledWith(json.toString());
        parse.mockRestore();
    });

    it('JS formatter should encode via vm', () => {
        const data = {};
        const stringify = jest.spyOn(JSON, 'stringify');
        Formatters.js.encode(data);
        expect(stringify).toHaveBeenCalledWith(data, null, expect.anything());
        stringify.mockRestore();
    });

    it('JSON formatter should decode via JSON object', () => {
        const json = Buffer.from('module.exports = {}');
        const parse = jest.spyOn(vm, 'runInNewContext');
        const result = Formatters.js.decode(json);
        expect(result).toEqual({});
        expect(parse).toHaveBeenCalledWith(json.toString(), expect.any(Object));
        parse.mockRestore();
    });
});
