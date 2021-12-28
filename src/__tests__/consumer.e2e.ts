import * as CP from 'child_process';

function exec(command: string) {
  return new Promise((resolve, reject) => {
    CP.exec(command, (err, stdout, stderr) => {
      if (err) {
        Object.assign(err, { stderr });
        reject(err as CP.ExecException & { stderr: string });
      } else {
        resolve(stdout);
      }
    });
  })
}

describe('E2E test suite', () => {
  it('Should', () => {

  });
});
