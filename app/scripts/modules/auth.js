define([
        'angular',
        'jquery'
    ], function(
        angular,
        jQuery
    ) {
'use strict';

angular.module('wdAuth', ['wdCommon'])
    .provider('wdAuthFilter', function() {
        var self = this;
        self.needAuth = ['$q', 'wdAuthToken', function($q, wdAuthToken) {
            var deferred = $q.defer();
            if (wdAuthToken.valid()) {
                deferred.resolve('ok');
            }
            else {
                deferred.reject('wd_auth_failed');
            }
            return deferred.promise;
        }];
        self.$get = [function() {
            return {
            };
        }];
    })
    .factory('wdAuthToken', ['$window', '$location', 'wdDev', function($window, $location, wdDev) {
        var valid = false;
        return {
            valid: function() {
                return valid;
            },
            getToken: function() {
                return $window.localStorage.getItem('token');
            },
            setToken: function(newToken) {
                $window.localStorage.setItem('token', newToken);
                valid = true;
            },
            clearToken: function() {
                $window.localStorage.removeItem('token');
                valid = false;
            },
            signout: function() {
                this.clearToken();
                if (wdDev.query('ac')) {
                    $window.location = $window.location.pathname + '#/portal';
                }
                else {
                    $location.path('/portal');
                }
            },
            parse: function (input) {
                var type = parseInt(input.slice(0, 1), 10);
                var encryptedIp = parseInt(input.slice(3, input.length), 10);
                var ip;
                switch (type) {
                case 2:
                    ip = '192.168.' + [
                        Math.floor(encryptedIp / 256),
                        encryptedIp % 256
                    ].join('.');
                    break;
                case 3:
                    ip = '172.' + [
                        Math.floor(encryptedIp / Math.pow(256, 2)),
                        Math.floor((encryptedIp % Math.pow(256, 2)) / 256),
                        encryptedIp % 256
                    ].join('.');
                    break;
                case 4:
                    ip = [
                        Math.floor(encryptedIp / Math.pow(256, 3)),
                        Math.floor((encryptedIp % Math.pow(256, 3)) / Math.pow(256, 2)),
                        Math.floor((encryptedIp % Math.pow(256, 2)) / 256),
                        encryptedIp % 256
                    ].join('.');
                    break;
                }

                return ip;
            }
        };
    }])
    .controller('portalController', ['$scope', '$location', '$http', 'wdDev', '$route', '$timeout', 'wdAuthToken', 'wdKeeper', 'GA', 'wdAlert',
        function($scope, $location, $http, wdDev, $route, $timeout, wdAuthToken, wdKeeper, GA, wdAlert) {

        $scope.isSafari = jQuery.browser.safari;
        $scope.authCode = wdDev.query('ac') || wdAuthToken.getToken() || '';
        $scope.autoAuth = !!$scope.authCode;
        $scope.buttonText = '连接手机';
        $scope.errorText = '';
        $scope.state = 'standby';
        $scope.showHelp = false;
        $scope.safariHelp = function() {
            wdAlert.alert('更改您的 Safari 设置', '连接手机失败，请前往设置/隐私中，将「阻止 cookie」一项设为「永不」。');
        };
        $scope.userInput = function() {
            if ($scope.state !== 'standby') {
                return;
            }
            $scope.buttonText = '连接手机';
        };
        $scope.submit = function() {
            if (!$scope.authCode) {
                GA('login:enter_authcode:empty');
                return;
            }
            if ($scope.autoAuth) {
                GA('login:auto');
            }
            // Parse data source.
            var ip = wdAuthToken.parse($scope.authCode);
            var port = 10208;

            var keeper = null;

            // Valid auth code.
            if (ip) {
                if ($scope.autoAuth) {
                    GA('login:auto_authcode:valid');
                }
                else {
                    GA('login:enter_authcode:valid');
                }
                // Send auth request.
                $scope.state = 'loading';
                wdDev.setServer(ip, port);
                keeper = wdKeeper.push('仍在发送验证码');
                var timeStart = (new Date()).getTime();
                $http({
                    method: 'get',
                    url: '/directive/auth',
                    timeout: 5000,
                    params: {
                        authcode: $scope.authCode,
                        'client_time': (new Date()).getTime(),
                        'client_name': 'Browser',
                        'client_type': 3
                    }
                })
                .success(function() {
                    keeper.done();
                    $scope.state = 'standby';
                    $scope.buttonText = '验证成功';
                    // TODO: Maybe expiration?
                    wdAuthToken.setToken($scope.authCode);
                    $location.url($route.current.params.ref || '/');
                    GA('login:success');
                    GA('perf:auth_duration:success:' + ((new Date()).getTime() - timeStart));
                })
                .error(function() {
                    keeper.done();
                    $scope.state = 'standby';
                    $scope.buttonText = '验证失败';
                    $scope.errorText = '请检查验证码或确保电脑和手机在同一 Wi-Fi 网络中';
                    $timeout(function() {
                        $scope.buttonText = '连接手机';
                        $scope.errorText = '';
                    }, 5000);
                    wdAuthToken.clearToken();
                    if ($scope.autoAuth) {
                        $route.reload();
                    }
                    GA('login:fail');
                    GA('perf:auth_duration:fail:' + ((new Date()).getTime() - timeStart));
                });
            }
            // Invalid auth code.
            else {
                if ($scope.autoAuth) {
                    GA('login:auto_authcode:invalid');
                }
                else {
                    GA('login:enter_authcode:invalid');
                }
                $scope.errorText = '请检查验证码或确保电脑和手机在同一 Wi-Fi 网络中';
                $timeout(function() {
                    $scope.errorText = '';
                }, 5000);
            }
        };

        if ($scope.authCode) {
            $timeout($scope.submit, 0);
        }
    }])
    .run(['$rootScope', '$location', function($rootScope, $location) {
        // $rootScope.$on('$routeChangeStart', function() {
        //     console.log('start', arguments);
        // });
        // $rootScope.$on('$routeChangeSuccess', function() {
        //     console.log('success', arguments);
        // });
        $rootScope.$on('$routeChangeError', function() {
            $location.url('/portal?ref=' + encodeURIComponent($location.url()));
        });
    }]);

});
