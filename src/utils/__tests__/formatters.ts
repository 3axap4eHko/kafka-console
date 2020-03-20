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
        const json = '{}';
        const parse = jest.spyOn(JSON, 'parse');
        Formatters.json.decode(json);
        expect(parse).toHaveBeenCalledWith(json);
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
        const json = '{}';
        const parse = jest.spyOn(vm, 'runInNewContext');
        Formatters.js.decode(json);
        expect(parse).toHaveBeenCalledWith(json, expect.any(Object));
        parse.mockRestore();
    });
});
