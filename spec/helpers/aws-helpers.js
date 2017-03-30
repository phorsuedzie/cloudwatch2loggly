'use strict';

jasmine.getGlobal().stubAwsServiceCall = (service, method, returnValue) => {
  var spy = spyOn(service, method);
  spy.setReturnValue = function(newReturnValue) {
    this.and.returnValue({
      promise: () => {
        if (newReturnValue instanceof Error) {
          return Promise.reject(newReturnValue);
        } else {
          return Promise.resolve(newReturnValue);
        }
      }
    });
  };
  spy.setReturnValue(returnValue || {});
  return spy;
};
