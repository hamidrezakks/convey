const React = require('react');

const useEffectEvent =
  React.useEffectEvent ||
  function useEffectEvent(fn) {
    const ref = React.useRef(fn);
    React.useInsertionEffect(() => {
      ref.current = fn;
    }, [fn]);
    return React.useCallback((...args) => ref.current(...args), []);
  };

module.exports = {
  ...React,
  default: React.default || React,
  useEffectEvent,
};
