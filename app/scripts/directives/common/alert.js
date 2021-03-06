define([], function() {
'use strict';
return [function() {
    var noop = function() {};
    return {
        scope: {},
        controller: ['wdAlert', '$scope', '$q', '$attrs', '$element',
        function(wdAlert, $scope, $q, $attrs, $element) {
            $scope.toggle = false;
            $scope.ok = noop;
            $scope.cancel = noop;
            $scope.header = '提示';
            $scope.content = '';

            wdAlert.registerModal({
                open: function(header, content, onlyOk) {
                    var deferred = $q.defer();

                    if (header) {
                        $attrs.$set('header', header);
                    }

                    $scope.content = content;
                    $scope.toggle = true;

                    $scope.ok = function() {
                        $scope.toggle = false;
                        deferred.resolve();
                    };
                    $scope.cancel = function() {
                        $scope.toggle = false;
                        deferred.reject();
                    };

                    $element.find('.modal-footer [bs-modal-cancel]').toggle(!onlyOk);

                    return deferred.promise;
                }
            });
        }],
        compile: function(element, attrs) {
            // Inject attrs into bsModul for using isolate scope.
            attrs.$set('toggle', 'toggle');
            attrs.$set('ok', 'ok()');
            attrs.$set('cancel', 'cancel()');
            // Inject text content.
            element.find('[ng-transclude]')
                .removeAttr('ng-transclude')
                .text('{{content}}');
            // No need for linking, just depends on bsModal.
            return function(scope) {};
        }
    };
}];
});
