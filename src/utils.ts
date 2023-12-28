export function getStr(string: string, start: string, end: string) { // get part of stringg passing start and end
  var str
  var canSplit = function (str: string, token: string) {
    return (str || '').split(token).length > 1;
  }
  if (canSplit(string, start)) {
    str = string.split(start);
    if (end) {
      str = str[1].split(end);
      return str[0];
    } else { return str = str[1]; }

  } else { return "" }
}


export function sleep(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

type TFindKeyObj<T> = {
  [key: string]: T | TFindKeyObj<T>;
};

export function findKey<T>(obj: TFindKeyObj<T>, key: string): T | null | any {
  for (const k in obj) {
    if (k === key) {
      return obj[k] as T;
    }
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      const value = findKey(obj[k] as TFindKeyObj<T>, key);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

