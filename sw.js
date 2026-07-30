const APP_VERSION = "0.1.425";
const APP_BUILD_ID = "2026.07.03-070443";
const APP_BUILT_AT = "2026-07-03T07:04:43.292Z";
const PWA_INSTANCE_ID = "cordyceps";
const PWA_INSTANCE_LABEL = "Cordyceps";
const APP_FORCE_UPDATE = "false" === "true";
const APP_FORCE_UPDATE_REASON = "";
const RELEASE_MANIFEST_PATH = "/release-manifest.json";
const RELEASE_SIGNING_KEY_ID = "cordyceps-release-v1";
const RELEASE_SIGNING_PUBLIC_KEY_SPKI_BASE64 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjJTLv5AXjgRoZKUZy+9zhczdQGnzoF0FMbchl3DnTDzl1/f+J2rjg5xYOhaqLpd8g5FsYIbZR0VUrsr4x4fU345PqWL0TwH2z7Q89652qUtEGSatvqmCk8UrTGNRF5M0+VbviXizDZYFyhj1od5mUmxvmLDZAWvvFAzAVENb/90tNR8kac+qC2Jr3BotnaP65cCarF8sniKo67A3s3n99QIw6rDflnBW4TWb6nGkHpI8m+/fZ7MHzgcTbGk2BzQzdijOhIcfFS0sPSMUSDFGxKB7l82F+mbRmcaR/XJWvs8UfM6rUfLKm2mKifXgnbuyihkOpOeXwpzNgidMYJD/7QIDAQAB";
const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
const RELEASE_SIGNATURE_ALGORITHM = "RSASSA-PKCS1-v1_5_SHA256";
const INSTANCE_CACHE_PREFIX = `cordyceps-${PWA_INSTANCE_ID}-`;
const APP_SHELL_CACHE = `${INSTANCE_CACHE_PREFIX}shell-${APP_BUILD_ID}`;
const RUNTIME_CACHE = `${INSTANCE_CACHE_PREFIX}runtime-v329`;
const UPDATE_APPROVAL_CACHE = `${INSTANCE_CACHE_PREFIX}update-approval-v329`;
const LEGACY_UPDATE_APPROVAL_CACHES = [
  `${INSTANCE_CACHE_PREFIX}update-approval-v328`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v327`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v326`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v325`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v324`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v323`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v322`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v321`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v320`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v319`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v318`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v317`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v316`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v315`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v314`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v313`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v312`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v311`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v310`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v309`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v308`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v307`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v306`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v305`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v304`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v303`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v302`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v301`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v300`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v299`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v298`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v297`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v296`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v295`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v294`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v293`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v292`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v291`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v290`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v289`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v288`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v287`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v286`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v285`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v284`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v283`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v282`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v281`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v280`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v279`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v278`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v277`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v276`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v275`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v274`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v273`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v272`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v271`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v270`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v269`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v268`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v267`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v266`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v265`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v264`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v263`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v262`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v261`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v260`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v259`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v258`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v257`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v256`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v255`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v254`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v253`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v252`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v251`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v250`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v249`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v248`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v247`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v246`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v245`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v244`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v243`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v242`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v241`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v240`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v239`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v238`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v237`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v236`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v235`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v234`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v233`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v232`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v231`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v230`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v229`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v228`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v227`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v226`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v225`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v224`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v223`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v222`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v221`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v220`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v219`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v218`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v217`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v216`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v215`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v214`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v213`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v212`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v211`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v210`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v209`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v208`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v207`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v206`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v205`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v204`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v203`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v202`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v201`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v200`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v199`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v198`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v197`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v196`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v195`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v194`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v193`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v192`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v191`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v190`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v189`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v188`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v187`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v186`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v185`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v184`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v183`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v182`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v181`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v180`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v179`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v178`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v177`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v176`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v175`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v174`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v173`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v172`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v171`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v170`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v169`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v168`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v167`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v166`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v165`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v164`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v163`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v162`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v161`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v160`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v159`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v158`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v157`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v156`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v155`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v154`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v153`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v152`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v151`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v150`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v149`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v148`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v147`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v146`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v145`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v144`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v143`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v142`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v141`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v140`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v139`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v138`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v137`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v136`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v135`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v134`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v133`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v132`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v131`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v130`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v129`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v128`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v127`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v126`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v125`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v124`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v123`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v122`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v121`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v120`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v119`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v118`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v117`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v116`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v115`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v114`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v113`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v112`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v111`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v110`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v109`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v108`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v107`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v106`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v105`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v104`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v103`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v102`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v101`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v100`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v99`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v98`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v97`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v96`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v95`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v94`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v93`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v92`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v91`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v90`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v89`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v88`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v87`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v86`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v85`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v84`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v83`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v82`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v81`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v80`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v79`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v78`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v77`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v76`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v75`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v74`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v73`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v72`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v71`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v70`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v69`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v68`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v67`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v66`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v65`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v64`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v63`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v62`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v61`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v60`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v59`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v58`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v57`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v56`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v55`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v54`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v53`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v52`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v51`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v50`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v49`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v48`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v47`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v46`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v45`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v44`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v43`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v42`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v41`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v40`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v39`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v38`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v37`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v36`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v35`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v34`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v33`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v32`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v31`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v30`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v29`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v28`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v27`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v26`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v25`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v24`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v23`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v22`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v21`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v20`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v19`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v18`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v17`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v16`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v15`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v14`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v13`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v12`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v11`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v10`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v9`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v8`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v7`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v6`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v5`,
  `${INSTANCE_CACHE_PREFIX}update-approval-v4`
];
const INSTANCE_UPDATE_STATE_CACHE_PREFIX = `${INSTANCE_CACHE_PREFIX}update-approval-`;
const LEGACY_UNSCOPED_UPDATE_STATE_CACHE_PREFIX = "cordyceps-update-approval-";
const LEGACY_UNSCOPED_UPDATE_APPROVAL_PATH = "/__cordyceps_update_approval__";
const UPDATE_APPROVAL_PATH = `/__cordyceps_${PWA_INSTANCE_ID}_update_approval__`;
const ACTIVATE_UPDATE_MESSAGE = "CORDYCEPS_ACTIVATE_UPDATE";
const FREEZE_TRUSTED_BUILD_MESSAGE = "CORDYCEPS_FREEZE_TRUSTED_BUILD";
const UNFREEZE_TRUSTED_BUILD_MESSAGE = "CORDYCEPS_UNFREEZE_TRUSTED_BUILD";
const APP_BOOT_READY_MESSAGE = "CORDYCEPS_APP_BOOT_READY";
const BROWSER_SHELL_REFRESH_MESSAGE = "CORDYCEPS_BROWSER_SHELL_REFRESH";
const BROWSER_SHELL_REFRESH_QUERY_PARAM = "shellRefresh";
const APP_BOOT_READY_PATH = `/__cordyceps_${PWA_INSTANCE_ID}_app_boot_ready__`;
const FORCE_UPDATE_ACTIVATION_PATH = `/__cordyceps_${PWA_INSTANCE_ID}_force_update_activation__`;
const INSTALLED_RELEASE_PATH = `/__cordyceps_${PWA_INSTANCE_ID}_installed_release_${APP_BUILD_ID}__`;
const TRUSTED_BUILD_PATH = `/__cordyceps_${PWA_INSTANCE_ID}_trusted_build__`;
const APP_BOOT_READY_TTL_MS = 5 * 60 * 1000;
const BROWSER_SHELL_REFRESH_TTL_MS = 30 * 1000;
const LOCAL_DB_NAME = "cordyceps.local.v1";
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE_NAME = "records";
const NOTIFICATION_SNAPSHOT_KEY = "notification-snapshot";
const NORMAL_NOTIFICATION_ICON = "./icons/icon-192.png";
const URGENT_NOTIFICATION_ICON = "./icons/icon-urgent-192.png?v=20260505-red-cordy";
const DEFAULT_NOTIFICATION_VIBRATION = [160, 80, 160];
const URGENT_NOTIFICATION_VIBRATION = [200, 100, 200, 100, 400];
const APP_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/app/backup-helpers.js",
  "/app/backup-io.js",
  "/app/backup-local-data.js",
  "/app/backup.js",
  "/app/bootstrap.js",
  "/app/calendar-ops.js",
  "/app/calendar.js",
  "/app/feature-sync.js",
  "/app/goals.js",
  "/app/habits-ops.js",
  "/app/habits.js",
  "/app/monzo-local-state.js",
  "/app/monzo-settings.js",
  "/app/navigation.js",
  "/app/outlook.js",
  "/app/pages.js",
  "/app/push-alerts.js",
  "/app/swipe-gestures.js",
  "/app/task-handlers.js",
  "/app/todo-swipe.js",
  "/app/ui-theme.js",
  "/apple-touch-icon-120x120.png",
  "/apple-touch-icon-152x152.png",
  "/apple-touch-icon-167x167.png",
  "/apple-touch-icon-180x180.png",
  "/apple-touch-icon.png",
  "/assets/apple-touch-icon-CYtwDItZ.png",
  "/assets/calendar-ops-C35qkn2l.js",
  "/assets/cordy-bg-4-C7peyG1Q.png",
  "/assets/EBGaramond-Italic-Variable-Dc4bZUzc.ttf",
  "/assets/EBGaramond-Variable-C01H6Xje.ttf",
  "/assets/GeistMono-Regular-IeQA31Tc.woff2",
  "/assets/GeistMono-SemiBold-BVWmKzED.woff2",
  "/assets/icon-120-B-44xR6C.png",
  "/assets/icon-152-Bu1D02N1.png",
  "/assets/icon-167-B_zOHJzm.png",
  "/assets/icon-192-C5Dk5d2y.png",
  "/assets/icon-512-0wsXqzOT.png",
  "/assets/index-BINDwMoN.js",
  "/assets/index-DDNTBZM-.css",
  "/assets/index-evVGCbrK.js",
  "/assets/index-NLAXGcbL.js",
  "/assets/Inter-Italic-Variable-CNBC7ArP.ttf",
  "/assets/Inter-Variable-VF2RPR_K.ttf",
  "/assets/LibreBaskerville-Italic-Variable-HFtBxu8I.ttf",
  "/assets/LibreBaskerville-Variable-DdwRD5QR.ttf",
  "/assets/Lusitana-Bold-B2fnHvJa.woff2",
  "/assets/Lusitana-Regular-MFGS-otx.woff2",
  "/assets/myceliaWebLlmWorker-26S72OWG.js",
  "/assets/ort-wasm-simd-threaded.asyncify-Nj-RkdLz.wasm",
  "/assets/transformers.web-BdcQd-x-.js",
  "/features/books/dom.js",
  "/features/books/index.js",
  "/features/books/state.js",
  "/features/books/storage.js",
  "/features/books/view.js",
  "/features/notes/dom.js",
  "/features/notes/index.js",
  "/features/notes/storage.js",
  "/features/notes/view.js",
  "/features/rss/dom.js",
  "/features/rss/index.js",
  "/features/rss/news-notifications.js",
  "/features/rss/view.js",
  "/features/shared/markdown.js",
  "/fonts/EBGaramond-Italic-Variable.ttf",
  "/fonts/EBGaramond-Variable.ttf",
  "/fonts/GeistMono-Regular.woff2",
  "/fonts/GeistMono-SemiBold.woff2",
  "/fonts/Inter-Italic-Variable.ttf",
  "/fonts/Inter-Variable.ttf",
  "/fonts/LibreBaskerville-Italic-Variable.ttf",
  "/fonts/LibreBaskerville-Variable.ttf",
  "/fonts/Lusitana-Bold.woff2",
  "/fonts/Lusitana-Regular.woff2",
  "/fonts/OFL-EBGaramond.txt",
  "/fonts/OFL-Inter.txt",
  "/fonts/OFL-LibreBaskerville.txt",
  "/icons/apple-touch-icon.png",
  "/icons/city-logo-ios.svg",
  "/icons/city-logo.svg",
  "/icons/icon-120.png",
  "/icons/icon-1254.png",
  "/icons/icon-152.png",
  "/icons/icon-167.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-urgent-192.png",
  "/ios-city-icon-120x120.png",
  "/ios-city-icon-152x152.png",
  "/ios-city-icon-167x167.png",
  "/ios-city-icon-180x180.png",
  "/ios-city-icon.png",
  "/manifest.json",
  "/manifest.webmanifest",
  "/modules/api.js",
  "/modules/dom.js",
  "/modules/local-store.js",
  "/modules/local-vault.js",
  "/modules/pending-writes.js",
  "/modules/push.js",
  "/modules/state.js",
  "/modules/storage-scope.js",
  "/modules/ui.js",
  "/styles-pages.css",
  "/styles-shell.css",
  "/styles-themes.css",
  "/styles.css",
  "/ui/theme.js",
  "/vendor/epubjs/epub.min.js",
  "/vendor/ocr/lang-data/eng.traineddata.gz",
  "/vendor/ocr/tesseract-core/tesseract-core-lstm.wasm",
  "/vendor/ocr/tesseract-core/tesseract-core-lstm.wasm.js",
  "/vendor/ocr/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm",
  "/vendor/ocr/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "/vendor/ocr/tesseract-core/tesseract-core-simd-lstm.wasm",
  "/vendor/ocr/tesseract-core/tesseract-core-simd-lstm.wasm.js",
  "/vendor/ocr/worker.min.js",
  "/vendor/ocr/worker.min.js.LICENSE.txt",
  "/vendor/pdfjs/pdf.min.mjs",
  "/vendor/pdfjs/pdf.worker.min.mjs"
];
const REQUIRED_APP_SHELL_ASSETS = new Set(["/index.html"]);
const NETWORK_ONLY_PATHS = new Set([
  "/version.json",
  RELEASE_MANIFEST_PATH,
]);
let releaseVerificationKeyPromise = null;
let verifiedReleaseManifestPromise = null;

self.addEventListener("install", (event) => {
  event.waitUntil(
    assertInstallAllowed()
      .then(precacheAppShell)
      .then(persistInstalledReleaseRecord)
      .then(() => maybeActivateApprovedInstall())
      .then(() => maybeActivateForceUpdateImmediately())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    cleanupOldCaches()
      .then(clearUpdateApproval)
      .then(async () => {
        const forceUpdateIntent = await readForceUpdateActivationIntent();
        await self.clients.claim();
        if (
          forceUpdateIntent?.buildId === APP_BUILD_ID
          && forceUpdateIntent?.instanceId === PWA_INSTANCE_ID
        ) {
          await reloadWindowClients();
        }
      })
      .then(clearForceUpdateActivationIntent)
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === APP_BOOT_READY_MESSAGE) {
    if (event.data?.instanceId && event.data.instanceId !== PWA_INSTANCE_ID) {
      return;
    }

    event.waitUntil(writeAppBootReady(event.data));
    return;
  }

  if (event.data?.type === BROWSER_SHELL_REFRESH_MESSAGE) {
    if (event.data?.instanceId && event.data.instanceId !== PWA_INSTANCE_ID) {
      return;
    }

    event.waitUntil(handleBrowserShellRefreshMessage(event));
    return;
  }

  if (event.data?.type === FREEZE_TRUSTED_BUILD_MESSAGE) {
    if (event.data?.instanceId && event.data.instanceId !== PWA_INSTANCE_ID) {
      return;
    }

    event.waitUntil(handleFreezeTrustedBuildMessage(event));
    return;
  }

  if (event.data?.type === UNFREEZE_TRUSTED_BUILD_MESSAGE) {
    if (event.data?.instanceId && event.data.instanceId !== PWA_INSTANCE_ID) {
      return;
    }

    event.waitUntil(handleUnfreezeTrustedBuildMessage(event));
    return;
  }

  if (event.data?.type !== ACTIVATE_UPDATE_MESSAGE) {
    return;
  }

  if (event.data?.buildId && event.data.buildId !== APP_BUILD_ID) {
    return;
  }

  if (event.data?.instanceId && event.data.instanceId !== PWA_INSTANCE_ID) {
    return;
  }

  event.waitUntil(handleApprovedUpdateActivation(event));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const { request } = event;
  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isSameOrigin = url.origin === self.location.origin;

  // v2 lane isolation guard: the v2 app is mounted at /v2/* on the same origin
  // and owns its own service worker at /v2/sw.js. Skip everything under /v2/ so
  // v1's caches never touch v2 assets before the v2 SW claims its scope.
  if (isSameOrigin && (url.pathname === "/v2" || url.pathname.startsWith("/v2/"))) {
    return;
  }

  if (isSameOrigin && NETWORK_ONLY_PATHS.has(url.pathname)) {
    return;
  }

  if (isNavigation) {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (isSameOrigin && url.pathname.startsWith("/api/")) {
    return;
  }

  const isAppAsset =
    isSameOrigin &&
    (url.pathname === "/" ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".mjs") ||
      url.pathname.endsWith(".woff2") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".webmanifest"));

  if (isAppAsset) {
    event.respondWith(handleAppAssetRequest(request));
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  event.respondWith(handleRuntimeRequest(request, RUNTIME_CACHE));
});

/**
 * Stale-while-revalidate: return the cached response immediately if available,
 * always kick off a background fetch to keep the cache fresh.
 * Falls through to the network on a cold cache (first visit).
 */
async function staleWhileRevalidate(request, cacheName, fallbackRequests = []) {
  const cached = await matchCached(cacheName, request, fallbackRequests);

  // Always revalidate in the background (fire-and-forget on cache hit).
  const revalidate = fetch(request).then(async (response) => {
    await cacheResponse(cacheName, request, response);
    return response;
  }).catch(() => null);

  if (cached) {
    return cached;
  }

  // Cold cache — must wait for the network.
  const fresh = await revalidate;
  if (fresh) {
    return fresh;
  }

  throw new Error("Resource unavailable");
}

async function cacheFirst(request, cacheName, fallbackRequests = []) {
  const cached = await matchCached(cacheName, request, fallbackRequests);
  if (cached) {
    return cached;
  }

  const fresh = await fetch(new Request(request, { cache: "reload" }));
  await cacheResponse(cacheName, request, fresh);
  return fresh;
}

async function networkFirst(request, cacheName, fallbackRequests = []) {
  try {
    const fresh = await fetch(new Request(request, { cache: "reload" }));
    await cacheResponse(cacheName, request, fresh);
    return fresh;
  } catch {
    const cached = await matchCached(cacheName, request, fallbackRequests);
    if (cached) {
      return cached;
    }
    throw new Error("Navigation unavailable offline");
  }
}

async function handleNavigationRequest(event) {
  const url = new URL(event.request.url);
  const refreshClientId = await readPendingBrowserShellRefreshClientId(event);
  if (refreshClientId || isBrowserShellRefreshNavigationUrl(url)) {
    return serveFreshBrowserShellNavigation(event.request, refreshClientId);
  }

  // Keep the installed shell pinned until a new service worker is explicitly
  // approved and activated. Otherwise a live HTML fetch can pull a newer app
  // bundle before the update dialog is accepted.
  return cacheFirst(event.request, APP_SHELL_CACHE, ["/", "/index.html"]);
}

function isBrowserShellRefreshNavigationUrl(url) {
  return (
    url.searchParams.has(BROWSER_SHELL_REFRESH_QUERY_PARAM)
    && !url.searchParams.has("app")
    && !url.searchParams.has("openApp")
  );
}

async function serveFreshBrowserShellNavigation(request, clientId = "") {
  try {
    const fresh = await fetch(new Request(request, { cache: "reload" }));
    await cacheResponse(APP_SHELL_CACHE, request, fresh);
    if (clientId) {
      await clearBrowserShellRefreshRequest(clientId);
    }
    return fresh;
  } catch {
    const cached = await matchCached(APP_SHELL_CACHE, request, ["/", "/index.html"]);
    if (cached) {
      return cached;
    }
    throw new Error("Navigation unavailable offline");
  }
}

async function handleAppAssetRequest(request) {
  // Assets carry version query strings — serve from cache first, revalidate in background.
  // No HTML fallbacks here: serving index.html for a .js/.css request causes parse errors.
  return cacheFirst(request, APP_SHELL_CACHE);
}

async function handleRuntimeRequest(request, cacheName) {
  return staleWhileRevalidate(request, cacheName);
}

async function matchCached(cacheName, request, fallbackRequests = []) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    return cached;
  }

  for (const fallbackRequest of fallbackRequests) {
    const fallback = await cache.match(fallbackRequest, { ignoreSearch: true });
    if (fallback) {
      return fallback;
    }
  }

  return undefined;
}

async function cacheResponse(cacheName, request, response) {
  if (!response || response.status >= 400) {
    return;
  }

  if (response.type !== "basic" && response.type !== "cors" && response.type !== "opaque") {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function assertInstallAllowed() {
  const verifiedManifest = await fetchAndVerifyReleaseManifest();
  assertReleaseManifestTargetsCurrentBuild(verifiedManifest);

  const trustedBuild = await readTrustedBuildRecord();
  if (isTrustedBuildBlockingRelease(trustedBuild, {
    instanceId: verifiedManifest.pwaInstanceId,
    releaseManifestSha256: verifiedManifest.releaseManifestSha256,
  })) {
    throw new Error(
      `${PWA_INSTANCE_LABEL} is frozen on trusted build ${formatTrustedBuildSummary(trustedBuild)}. `
      + `Unfreeze updates before installing ${APP_BUILD_ID}.`,
    );
  }

  if (APP_FORCE_UPDATE || !self.registration.active) {
    await assertReleaseManifestCoreAssets(verifiedManifest);
    return;
  }

  const cacheKeys = await caches.keys();
  const hasPinnedShell = cacheKeys.some((key) => key.startsWith(`${INSTANCE_CACHE_PREFIX}shell-`));
  if (!hasPinnedShell) {
    await assertReleaseManifestCoreAssets(verifiedManifest);
    return;
  }

  const approval = await readUpdateApproval();
  if (isApprovedInstall(approval, verifiedManifest)) {
    return;
  }

  throw new Error(`${PWA_INSTANCE_LABEL} update ${APP_BUILD_ID} is waiting for user approval.`);
}

function isApprovedInstall(approval, verifiedManifest) {
  return approval?.buildId === APP_BUILD_ID
    && approval?.instanceId === PWA_INSTANCE_ID
    && approval?.releaseManifestPath === verifiedManifest.releaseManifestPath
    && approval?.releaseManifestSha256 === verifiedManifest.releaseManifestSha256;
}

async function reloadWindowClients({ targetClientId = "" } = {}) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const targetClients =
    targetClientId && clients.some((client) => client.id === targetClientId)
      ? clients.filter((client) => client.id === targetClientId)
      : clients;
  await Promise.allSettled(
    targetClients.map(async (client) => {
      try {
        await client.navigate(client.url);
      } catch {
        // Some browsers may reject forced client navigations during activation.
      }
    })
  );
}

async function maybeActivateForceUpdateImmediately() {
  const installedReleaseRecord = await readInstalledReleaseRecord();
  const trustedBuild = await readTrustedBuildRecord();
  if (isTrustedBuildBlockingRelease(trustedBuild, installedReleaseRecord)) {
    await clearForceUpdateActivationIntent();
    return;
  }

  if (!(await shouldActivateForceUpdateImmediately())) {
    await clearForceUpdateActivationIntent();
    return;
  }

  await writeForceUpdateActivationIntent();
  await self.skipWaiting();
}

async function maybeActivateApprovedInstall() {
  if (APP_FORCE_UPDATE) {
    return;
  }

  const approval = await readUpdateApproval();
  if (!approval) {
    return;
  }

  const installedReleaseRecord = await readInstalledReleaseRecord();
  if (!installedReleaseRecord) {
    return;
  }

  if (
    approval.buildId !== APP_BUILD_ID
    || approval.instanceId !== PWA_INSTANCE_ID
    || approval.releaseManifestPath !== installedReleaseRecord.releaseManifestPath
    || approval.releaseManifestSha256 !== installedReleaseRecord.releaseManifestSha256
  ) {
    return;
  }

  const trustedBuild = await readTrustedBuildRecord();
  if (isTrustedBuildBlockingRelease(trustedBuild, installedReleaseRecord)) {
    return;
  }

  await self.skipWaiting();
}

async function persistInstalledReleaseRecord() {
  const verifiedManifest = await fetchAndVerifyReleaseManifest();
  await writeInstalledReleaseRecord(verifiedManifest);
}

async function handleBrowserShellRefreshMessage(event) {
  const reply = (payload) => {
    try {
      event.ports?.[0]?.postMessage(payload);
    } catch {
      // Best-effort acknowledgement for the refresh requester.
    }
  };

  try {
    const clientId = typeof event.source?.id === "string" ? event.source.id : "";
    if (!clientId) {
      throw new Error("The browser shell refresh request did not include a client id.");
    }

    await writeBrowserShellRefreshRequest(clientId, {
      clientId,
      requestedAt: new Date().toISOString(),
    });
    reply({ ok: true });
  } catch (error) {
    reply({ ok: false, error: formatBrowserShellRefreshError(error) });
  }
}

async function handleFreezeTrustedBuildMessage(event) {
  const reply = (payload) => {
    try {
      event.ports?.[0]?.postMessage(payload);
    } catch {
      // Best-effort acknowledgement for the freeze requester.
    }
  };

  try {
    const installedReleaseRecord = await readInstalledReleaseRecord();
    if (
      !installedReleaseRecord
      || installedReleaseRecord.buildId !== APP_BUILD_ID
      || installedReleaseRecord.instanceId !== PWA_INSTANCE_ID
      || typeof installedReleaseRecord.releaseManifestPath !== "string"
      || !installedReleaseRecord.releaseManifestPath
      || typeof installedReleaseRecord.releaseManifestSha256 !== "string"
      || !installedReleaseRecord.releaseManifestSha256
    ) {
      throw new Error("This install does not have a verified release record to freeze.");
    }

    const trustedBuild = {
      buildId: installedReleaseRecord.buildId,
      version:
        typeof installedReleaseRecord.version === "string" && installedReleaseRecord.version.trim()
          ? installedReleaseRecord.version.trim()
          : APP_VERSION,
      instanceId: installedReleaseRecord.instanceId,
      releaseManifestPath: installedReleaseRecord.releaseManifestPath,
      releaseManifestSha256: installedReleaseRecord.releaseManifestSha256,
      pinnedAt: new Date().toISOString(),
    };

    await writeTrustedBuildRecord(trustedBuild);
    reply({ ok: true, trustedBuild });
  } catch (error) {
    reply({ ok: false, error: formatTrustedBuildError(error) });
  }
}

async function handleUnfreezeTrustedBuildMessage(event) {
  const reply = (payload) => {
    try {
      event.ports?.[0]?.postMessage(payload);
    } catch {
      // Best-effort acknowledgement for the unfreeze requester.
    }
  };

  try {
    await clearTrustedBuildRecord();
    reply({ ok: true });
  } catch (error) {
    reply({ ok: false, error: formatTrustedBuildError(error) });
  }
}

async function shouldActivateForceUpdateImmediately() {
  if (!APP_FORCE_UPDATE) {
    return false;
  }

  if (!self.registration.active) {
    return true;
  }

  const appBootReady = await readAppBootReady();
  if (
    !appBootReady
    || appBootReady.instanceId !== PWA_INSTANCE_ID
    || typeof appBootReady.reportedAt !== "string"
  ) {
    return true;
  }

  const reportedAt = Date.parse(appBootReady.reportedAt);
  if (!Number.isFinite(reportedAt)) {
    return true;
  }

  return Date.now() - reportedAt > APP_BOOT_READY_TTL_MS;
}

async function handleApprovedUpdateActivation(event) {
  const reply = (payload) => {
    try {
      event.ports?.[0]?.postMessage(payload);
    } catch {
      // Best-effort acknowledgement for the activation requester.
    }
  };

  try {
    const approval = await readUpdateApproval();
    if (!approval) {
      throw new Error("The update approval expired before activation.");
    }

    if (
      approval.buildId !== APP_BUILD_ID
      || approval.instanceId !== PWA_INSTANCE_ID
    ) {
      throw new Error("The approved update no longer matches this waiting worker.");
    }

    if (
      typeof event.data.releaseManifestPath === "string"
      && event.data.releaseManifestPath
      && approval.releaseManifestPath !== event.data.releaseManifestPath
    ) {
      throw new Error("The approved update no longer matches this waiting worker.");
    }

    if (
      typeof event.data.releaseManifestSha256 === "string"
      && event.data.releaseManifestSha256
      && approval.releaseManifestSha256 !== event.data.releaseManifestSha256
    ) {
      throw new Error("The approved update no longer matches this waiting worker.");
    }

    const installedReleaseRecord = await readInstalledReleaseRecord();
    if (!installedReleaseRecord) {
      throw new Error("This waiting update no longer has a verified release record.");
    }

    if (
      installedReleaseRecord.buildId !== APP_BUILD_ID
      || installedReleaseRecord.instanceId !== PWA_INSTANCE_ID
      || installedReleaseRecord.releaseManifestPath !== approval.releaseManifestPath
      || installedReleaseRecord.releaseManifestSha256 !== approval.releaseManifestSha256
    ) {
      throw new Error("This waiting update no longer matches the approved signed manifest.");
    }

    const trustedBuild = await readTrustedBuildRecord();
    if (isTrustedBuildBlockingRelease(trustedBuild, installedReleaseRecord)) {
      throw new Error(
        `Updates are frozen on trusted build ${formatTrustedBuildSummary(trustedBuild)}. `
        + `Unfreeze updates before installing ${APP_BUILD_ID}.`,
      );
    }

    reply({ ok: true });
    await self.skipWaiting();
  } catch (error) {
    reply({ ok: false, error: formatUpdateActivationError(error) });
  }
}

function formatUpdateActivationError(error) {
  return error instanceof Error && error.message
    ? error.message
    : "The waiting update rejected activation.";
}

function formatBrowserShellRefreshError(error) {
  return error instanceof Error && error.message
    ? error.message
    : "The browser shell refresh request was rejected.";
}

function formatTrustedBuildError(error) {
  return error instanceof Error && error.message
    ? error.message
    : "The trusted-build request was rejected.";
}

async function precacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  const assets = getAppAssets();
  const requiredAssets = getRequiredAppShellAssets(assets);
  const optionalAssets = assets.filter((asset) => !requiredAssets.includes(asset));

  await Promise.all(requiredAssets.map((asset) => cacheAppShellAsset(cache, asset)));
  cacheOptionalAppShellAssets(cache, optionalAssets);
}

function getAppAssets() {
  return Array.isArray(APP_ASSETS) ? APP_ASSETS : ["/", "/index.html"];
}

function getRequiredAppShellAssets(assets) {
  const requiredAssets = assets.filter((asset) => REQUIRED_APP_SHELL_ASSETS.has(asset));
  if (requiredAssets.length) {
    return requiredAssets;
  }

  return assets.includes("/index.html") ? ["/index.html"] : ["/"];
}

async function cacheAppShellAsset(cache, asset) {
  const request = new Request(asset, { cache: "reload" });
  const response = await fetch(request);
  if (!response || response.status >= 400) {
    throw new Error(`Unable to precache ${asset}`);
  }
  await cache.put(request, response);
}

async function cacheOptionalAppShellAssets(cache, assets) {
  for (const asset of assets) {
    try {
      await cacheAppShellAsset(cache, asset);
    } catch {
      // Optional chunks can be slow on small VPS hosts; runtime caching will fill misses.
    }
  }
}

async function readUpdateApproval() {
  return readCachedUpdateState(UPDATE_APPROVAL_PATH);
}

async function clearUpdateApproval() {
  await deleteCachedUpdateState(UPDATE_APPROVAL_PATH);
}

async function readAppBootReady() {
  return readCachedUpdateState(APP_BOOT_READY_PATH);
}

async function writeAppBootReady(messageData = {}) {
  await writeCachedUpdateState(APP_BOOT_READY_PATH, {
    buildId: typeof messageData.buildId === "string" ? messageData.buildId : APP_BUILD_ID,
    instanceId: PWA_INSTANCE_ID,
    reportedAt: new Date().toISOString(),
  });
}

async function readForceUpdateActivationIntent() {
  return readCachedUpdateState(FORCE_UPDATE_ACTIVATION_PATH, { includeLegacy: false });
}

async function writeForceUpdateActivationIntent() {
  await writeCachedUpdateState(FORCE_UPDATE_ACTIVATION_PATH, {
    buildId: APP_BUILD_ID,
    instanceId: PWA_INSTANCE_ID,
    markedAt: new Date().toISOString(),
  });
}

async function clearForceUpdateActivationIntent() {
  await deleteCachedUpdateState(FORCE_UPDATE_ACTIVATION_PATH, { includeLegacy: false });
}

async function readInstalledReleaseRecord() {
  return readCachedUpdateState(INSTALLED_RELEASE_PATH, { includeLegacy: false });
}

async function writeInstalledReleaseRecord(verifiedManifest) {
  await writeCachedUpdateState(INSTALLED_RELEASE_PATH, {
    buildId: verifiedManifest.buildId,
    version: verifiedManifest.version,
    instanceId: verifiedManifest.pwaInstanceId,
    releaseManifestPath: verifiedManifest.releaseManifestPath,
    releaseManifestSha256: verifiedManifest.releaseManifestSha256,
    verifiedAt: new Date().toISOString(),
  });
}

async function readTrustedBuildRecord() {
  return readCachedUpdateState(TRUSTED_BUILD_PATH);
}

async function writeTrustedBuildRecord(trustedBuild) {
  await writeCachedUpdateState(TRUSTED_BUILD_PATH, trustedBuild);
}

async function clearTrustedBuildRecord() {
  await deleteCachedUpdateState(TRUSTED_BUILD_PATH);
}

async function readPendingBrowserShellRefreshClientId(event) {
  const clientId = typeof event.clientId === "string" ? event.clientId : "";
  if (!clientId) {
    return "";
  }

  const url = new URL(event.request.url);
  if (url.searchParams.has("app") || url.searchParams.has("openApp")) {
    return "";
  }

  const refreshRequest = await readBrowserShellRefreshRequest(clientId);
  if (!refreshRequest || typeof refreshRequest !== "object") {
    return "";
  }

  const requestedAt = Date.parse(String(refreshRequest.requestedAt || ""));
  if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > BROWSER_SHELL_REFRESH_TTL_MS) {
    await clearBrowserShellRefreshRequest(clientId);
    return "";
  }

  return clientId;
}

function getBrowserShellRefreshPath(clientId) {
  return `/__cordyceps_${PWA_INSTANCE_ID}_browser_shell_refresh_${encodeURIComponent(clientId)}__`;
}

async function readBrowserShellRefreshRequest(clientId) {
  return readCachedUpdateState(getBrowserShellRefreshPath(clientId), { includeLegacy: false });
}

async function writeBrowserShellRefreshRequest(clientId, payload) {
  await writeCachedUpdateState(getBrowserShellRefreshPath(clientId), payload);
}

async function clearBrowserShellRefreshRequest(clientId) {
  await deleteCachedUpdateState(getBrowserShellRefreshPath(clientId), { includeLegacy: false });
}

function getCompatibleUpdateStatePaths(path, { includeLegacy = true } = {}) {
  if (includeLegacy && path === UPDATE_APPROVAL_PATH) {
    return [path, LEGACY_UNSCOPED_UPDATE_APPROVAL_PATH];
  }

  return [path];
}

function isCompatibleUpdateStateCacheName(cacheName, path) {
  if (cacheName.startsWith(INSTANCE_UPDATE_STATE_CACHE_PREFIX)) {
    return true;
  }

  return path === UPDATE_APPROVAL_PATH && cacheName.startsWith(LEGACY_UNSCOPED_UPDATE_STATE_CACHE_PREFIX);
}

async function getExistingCompatibleUpdateStateCacheNames(path, { includeLegacy = true } = {}) {
  const cacheKeys = await caches.keys();
  const available = new Set(cacheKeys);
  const preferred = [];
  const preferredSet = new Set();
  const knownCacheNames =
    includeLegacy ? [UPDATE_APPROVAL_CACHE, ...LEGACY_UPDATE_APPROVAL_CACHES] : [UPDATE_APPROVAL_CACHE];

  for (const cacheName of knownCacheNames) {
    if (!available.has(cacheName) || !isCompatibleUpdateStateCacheName(cacheName, path)) {
      continue;
    }

    preferred.push(cacheName);
    preferredSet.add(cacheName);
  }

  for (const cacheName of cacheKeys) {
    if (preferredSet.has(cacheName) || !isCompatibleUpdateStateCacheName(cacheName, path)) {
      continue;
    }

    preferred.push(cacheName);
    preferredSet.add(cacheName);
  }

  return preferred;
}

async function readCachedUpdateState(path, { includeLegacy = true } = {}) {
  const requestPaths = getCompatibleUpdateStatePaths(path, { includeLegacy });
  const cacheNames = await getExistingCompatibleUpdateStateCacheNames(path, { includeLegacy });

  for (const requestPath of requestPaths) {
    const request = new Request(requestPath);
    for (const cacheName of cacheNames) {
      try {
        const cache = await caches.open(cacheName);
        const response = await cache.match(request);
        if (response) {
          return await response.json();
        }
      } catch {
        // Update state reads fall back across cache-name migrations.
      }
    }
  }
  return null;
}

async function writeCachedUpdateState(path, payload) {
  const cache = await caches.open(UPDATE_APPROVAL_CACHE);
  const response = new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
  await cache.put(new Request(path), response);
}

async function deleteCachedUpdateState(path, { includeLegacy = true } = {}) {
  const requests = getCompatibleUpdateStatePaths(path, { includeLegacy }).map((requestPath) => new Request(requestPath));
  const cacheNames = await getExistingCompatibleUpdateStateCacheNames(path, { includeLegacy });
  await Promise.allSettled(cacheNames.map(async (cacheName) => {
    const cache = await caches.open(cacheName);
    await Promise.allSettled(requests.map((request) => cache.delete(request)));
  }));
}

async function cleanupOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(`${INSTANCE_CACHE_PREFIX}shell-`) && key !== APP_SHELL_CACHE)
      .map((key) => caches.delete(key))
  );
}

async function fetchAndVerifyReleaseManifest() {
  verifiedReleaseManifestPromise ??= (async () => {
    const response = await fetch(new Request(RELEASE_MANIFEST_PATH, { cache: "no-store" }));
    if (!response.ok) {
      throw new Error(`Unable to load signed release manifest (${response.status}).`);
    }

    const manifestText = await response.text();
    const parsedManifest = parseSignedReleaseManifest(manifestText);
    const payloadJson = JSON.stringify(parsedManifest.payload);
    const payloadBytes = new TextEncoder().encode(payloadJson);
    const signatureBytes = decodeBase64(parsedManifest.signature.value);
    const verificationKey = await getReleaseVerificationKey();
    const isValid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      verificationKey,
      signatureBytes,
      payloadBytes,
    );

    if (!isValid) {
      throw new Error("The signed release manifest failed verification.");
    }

    return {
      ...normalizeReleaseManifestPayload(parsedManifest.payload),
      releaseManifestSha256: await sha256Base64(new TextEncoder().encode(manifestText)),
    };
  })();

  return verifiedReleaseManifestPromise;
}

function parseSignedReleaseManifest(manifestText) {
  let parsedManifest;
  try {
    parsedManifest = JSON.parse(manifestText);
  } catch {
    throw new Error("The signed release manifest is not valid JSON.");
  }

  if (Number(parsedManifest?.schemaVersion) !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw new Error("The signed release manifest schema is unsupported.");
  }

  if (!parsedManifest?.payload || typeof parsedManifest.payload !== "object" || Array.isArray(parsedManifest.payload)) {
    throw new Error("The signed release manifest payload is missing.");
  }

  if (!parsedManifest?.signature || typeof parsedManifest.signature !== "object" || Array.isArray(parsedManifest.signature)) {
    throw new Error("The signed release manifest signature is missing.");
  }

  if (parsedManifest.signature.algorithm !== RELEASE_SIGNATURE_ALGORITHM) {
    throw new Error("The signed release manifest algorithm is unsupported.");
  }

  if (parsedManifest.signature.keyId !== RELEASE_SIGNING_KEY_ID) {
    throw new Error("The signed release manifest key ID does not match this build.");
  }

  if (typeof parsedManifest.signature.value !== "string" || !parsedManifest.signature.value.trim()) {
    throw new Error("The signed release manifest signature is empty.");
  }

  return parsedManifest;
}

function normalizeReleaseManifestPayload(payload) {
  const record = payload && typeof payload === "object" ? payload : {};
  return {
    version: typeof record.version === "string" && record.version.trim() ? record.version.trim() : "",
    buildId: typeof record.buildId === "string" && record.buildId.trim() ? record.buildId.trim() : "",
    pwaInstanceId: typeof record.pwaInstanceId === "string" && record.pwaInstanceId.trim() ? record.pwaInstanceId.trim() : "",
    releaseManifestPath:
      typeof record.releaseManifestPath === "string" && record.releaseManifestPath.trim()
        ? record.releaseManifestPath.trim()
        : RELEASE_MANIFEST_PATH,
    assets: Array.isArray(record.assets)
      ? record.assets.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return [];
        }

        const releasePath = typeof entry.path === "string" && entry.path.trim() ? entry.path.trim() : "";
        const sha256 = typeof entry.sha256 === "string" && entry.sha256.trim() ? entry.sha256.trim() : "";
        return releasePath && sha256 ? [{ path: releasePath, sha256 }] : [];
      })
      : [],
  };
}

function assertReleaseManifestTargetsCurrentBuild(verifiedManifest) {
  if (verifiedManifest.buildId !== APP_BUILD_ID) {
    throw new Error(`Signed release manifest build mismatch: expected ${APP_BUILD_ID}, got ${verifiedManifest.buildId || "unknown"}.`);
  }

  if (verifiedManifest.version !== APP_VERSION) {
    throw new Error(`Signed release manifest version mismatch: expected ${APP_VERSION}, got ${verifiedManifest.version || "unknown"}.`);
  }

  if (verifiedManifest.pwaInstanceId !== PWA_INSTANCE_ID) {
    throw new Error(`Signed release manifest PWA instance mismatch: expected ${PWA_INSTANCE_ID}, got ${verifiedManifest.pwaInstanceId || "unknown"}.`);
  }
}

async function assertReleaseManifestCoreAssets(verifiedManifest) {
  await Promise.all([
    assertReleaseAssetDigest(verifiedManifest, "/index.html"),
    assertReleaseAssetDigest(verifiedManifest, "/sw.js"),
    assertReleaseAssetDigest(verifiedManifest, "/version.json"),
  ]);
}

async function assertReleaseAssetDigest(verifiedManifest, assetPath) {
  const assetEntry = verifiedManifest.assets.find((entry) => entry.path === assetPath);
  if (!assetEntry) {
    throw new Error(`Signed release manifest is missing ${assetPath}.`);
  }

  const response = await fetch(new Request(assetPath, { cache: "no-store" }));
  if (!response.ok) {
    throw new Error(`Unable to load ${assetPath} for release verification (${response.status}).`);
  }

  const digest = await sha256Base64(await response.arrayBuffer());
  if (digest !== assetEntry.sha256) {
    throw new Error(`${assetPath} does not match the signed release manifest.`);
  }
}

async function getReleaseVerificationKey() {
  releaseVerificationKeyPromise ??= crypto.subtle.importKey(
    "spki",
    decodeBase64(RELEASE_SIGNING_PUBLIC_KEY_SPKI_BASE64),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  return releaseVerificationKeyPromise;
}

function decodeBase64(value) {
  const normalized = String(value || "").trim();
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha256Base64(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  let binary = "";
  const bytes = new Uint8Array(digest);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function isTrustedBuildBlockingRelease(trustedBuild, releaseIdentity) {
  if (
    !trustedBuild
    || trustedBuild.instanceId !== PWA_INSTANCE_ID
    || !trustedBuild.releaseManifestSha256
    || !releaseIdentity
    || releaseIdentity.instanceId !== PWA_INSTANCE_ID
    || typeof releaseIdentity.releaseManifestSha256 !== "string"
    || !releaseIdentity.releaseManifestSha256
  ) {
    return false;
  }

  return trustedBuild.releaseManifestSha256 !== releaseIdentity.releaseManifestSha256;
}

function formatTrustedBuildSummary(trustedBuild) {
  const version =
    typeof trustedBuild?.version === "string" && trustedBuild.version.trim()
      ? `v${trustedBuild.version.trim()}`
      : "unknown version";
  const buildId =
    typeof trustedBuild?.buildId === "string" && trustedBuild.buildId.trim()
      ? trustedBuild.buildId.trim()
      : "unknown build";
  return `${version} · ${buildId}`;
}

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in self)) {
      reject(new Error("IndexedDB unavailable."));
      return;
    }

    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_STORE_NAME)) {
        database.createObjectStore(LOCAL_STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readLocalRecord(key) {
  const database = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_STORE_NAME, "readonly");
    const store = transaction.objectStore(LOCAL_STORE_NAME);
    const request = store.get(key);
    request.addEventListener("success", () => resolve(request.result?.value ?? request.result ?? null));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => database.close());
    transaction.addEventListener("abort", () => {
      database.close();
      reject(transaction.error);
    });
  });
}

async function readNotificationSnapshot() {
  try {
    return await readLocalRecord(NOTIFICATION_SNAPSHOT_KEY);
  } catch {
    return null;
  }
}

function parsePushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return normalizePushPayload(event.data.json());
  } catch {
    return {};
  }
}

function normalizePushPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const notification = payload.notification && typeof payload.notification === "object" ? payload.notification : {};
  return {
    ...payload,
    ...data,
    title: payload.title || data.title || notification.title,
    body: payload.body || data.body || notification.body,
    tag: payload.tag || data.tag,
    type: payload.type || data.type || data.kind,
    urgent: payload.urgent === true || data.urgent === "true" || data.urgent === true,
    url: payload.url || data.url || payload.fcmOptions?.link || "/?page=tasks",
    data: {
      ...data,
      url: data.url || payload.fcmOptions?.link || "/?page=tasks",
      kind: data.kind || data.type || payload.type || "generic-reminder"
    }
  };
}

function buildLocalNotification(snapshot, payload = {}) {
  const urgentTasks = Array.isArray(snapshot?.urgentTasks) ? snapshot.urgentTasks : [];
  const rituals = Array.isArray(snapshot?.rituals) ? snapshot.rituals : [];
  const upcomingEvents = Array.isArray(snapshot?.upcomingEvents) ? snapshot.upcomingEvents : [];
  const goals = Array.isArray(snapshot?.goals) ? snapshot.goals : [];
  const verbatim = snapshot?.verbatim && typeof snapshot.verbatim === "object" ? snapshot.verbatim : null;
  const nextPlanBlock = snapshot?.nextPlanBlock && typeof snapshot.nextPlanBlock === "object"
    ? snapshot.nextPlanBlock
    : null;
  const urgentTask = Array.isArray(snapshot?.urgentTasks)
    ? snapshot.urgentTasks.find((task) => task && typeof task.text === "string" && task.text.trim())
    : null;
  const refId = typeof payload.refId === "string" ? payload.refId : payload.data?.refId;
  const ritual = refId
    ? rituals.find((item) => item && item.id === refId)
    : null;
  const event = refId
    ? upcomingEvents.find((item) => item && item.id === refId)
    : null;
  const exactUrgentTask = refId
    ? urgentTasks.find((item) => item && item.id === refId)
    : null;
  const topGoal = goals.find((goal) => goal && goal.pendingSubgoalCount > 0) || goals[0] || null;
  const payloadKind = payload.type || payload.data?.kind || "generic-reminder";
  const reminderMinutes = Number.parseInt(String(payload.reminderMinutes ?? payload.data?.reminderMinutes ?? ""), 10);
  const hasPlanBlockPayload = payloadKind === "plan-block-reminder" || payloadKind === "plan-block-check";
  const hasRssNewsPayload = payloadKind === "rss-news" || payloadKind === "rss-news-check";
  const hasUrgentPayload = payload.urgent === true
    || payloadKind === "urgent-reminder"
    || payloadKind === "urgent-test"
    || payloadKind === "urgent-check"
    || payloadKind === "urgent-summary"
    || payloadKind === "urgent-task";
  const hasUrgentTask = Boolean(urgentTask) || hasUrgentPayload;
  const planBlockLabel = typeof nextPlanBlock?.label === "string" ? nextPlanBlock.label.trim() : "";
  const rawTitle = payload.title || (
    payloadKind === "ritual-start"
      ? "Ritual"
      : payloadKind === "reflection"
        ? "Reflection"
        : payloadKind === "event-reminder" || payloadKind === "event-final"
          ? "Event reminder"
          : payloadKind === "goal-reminder"
            ? "Goal reminder"
            : payloadKind === "verbatim"
              ? "Verbatim"
              : hasUrgentTask
                  ? "Urgent task"
                  : hasPlanBlockPayload
                    ? "Plan block soon"
                    : hasRssNewsPayload
                      ? "Latest news"
                      : "Cordyceps"
  );
  const title = hasUrgentTask && !/^urgent\b/i.test(rawTitle) ? `Urgent: ${rawTitle}` : rawTitle;
  const planBlockBody = planBlockLabel ? `${planBlockLabel} is coming up.` : "Your next Plan Your Day block is coming up.";
  const rssNewsBody = "Open RSS Feed for the latest saved-source news.";
  const urgentSummaryBody = `You have ${urgentTasks.length} urgent task${urgentTasks.length === 1 ? "" : "s"} left.`;
  const eventLeadMinutes = Number.isFinite(reminderMinutes) ? reminderMinutes : 0;
  const eventReminderBody = payloadKind === "event-final"
    ? `${event?.title || "Your event"} starts in a minute.`
    : `${event?.title || "Your event"} starts in ${eventLeadMinutes} min.`;
  const goalReminderBody = topGoal?.title ? `Remember what you want: ${topGoal.title}` : "Remember what you want.";

  return {
    title,
    body: payload.body || (
      payloadKind === "urgent-summary"
        ? urgentSummaryBody
        : payloadKind === "urgent-task"
          ? exactUrgentTask?.text?.trim() || urgentTask?.text?.trim() || "One urgent task still needs attention."
          : payloadKind === "ritual-start"
            ? `Your ${ritual?.title || "ritual"} starts now.`
            : payloadKind === "reflection"
              ? "Take a moment to reflect on today."
              : payloadKind === "event-reminder" || payloadKind === "event-final"
                ? eventReminderBody
                : payloadKind === "goal-reminder"
                ? goalReminderBody
                : payloadKind === "verbatim"
                  ? `You haven’t finished your daily translations yet${verbatim?.remaining > 0 ? ` (${verbatim.remaining} left)` : ""}.`
                    : urgentTask
                        ? urgentTask.text.trim()
                        : hasPlanBlockPayload
                          ? planBlockBody
                          : hasRssNewsPayload
                            ? rssNewsBody
                            : "Check Cordyceps."
    ),
    tag: payload.tag || (
      payloadKind === "ritual-start"
        ? `cordyceps-ritual-${refId || "next"}`
        : payloadKind === "reflection"
          ? "cordyceps-reflection"
          : payloadKind === "event-reminder" || payloadKind === "event-final"
            ? `cordyceps-event-${refId || "next"}-${payloadKind}`
            : payloadKind === "goal-reminder"
            ? "cordyceps-goal-reminder"
            : payloadKind === "verbatim"
              ? "cordyceps-verbatim"
                : hasUrgentTask
                    ? `cordyceps-task-${exactUrgentTask?.id || urgentTask?.id || "urgent"}`
                    : hasPlanBlockPayload
                      ? `cordyceps-plan-block-${nextPlanBlock?.id || "next"}`
                      : hasRssNewsPayload
                        ? "cordyceps-rss-news"
                        : "cordyceps-generic"
    ),
    data: {
      url: payload.url || payload.data?.url || (hasPlanBlockPayload ? "/?page=plan-your-day" : hasRssNewsPayload ? "/?page=rss" : "/?page=tasks"),
      kind: payloadKind,
      refId,
      reminderMinutes: eventLeadMinutes,
    },
    urgent: hasUrgentTask,
    badgeCount: hasUrgentTask ? Math.max(urgentTasks.length, 1) : 0
  };
}

async function syncAppBadge(notification) {
  if (!("setAppBadge" in self.navigator)) {
    return;
  }

  try {
    if (notification.urgent) {
      await self.navigator.setAppBadge(notification.badgeCount || 1);
    }
  } catch {
    // App badging is best-effort and may be blocked by platform settings.
  }
}

async function clearAppBadge() {
  if (!("clearAppBadge" in self.navigator)) {
    return;
  }

  try {
    await self.navigator.clearAppBadge();
  } catch {
    // App badging is best-effort and may be blocked by platform settings.
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const payload = parsePushPayload(event);
    const snapshot = await readNotificationSnapshot();
    const notification = buildLocalNotification(snapshot, payload);
    const notificationIcon = notification.urgent ? URGENT_NOTIFICATION_ICON : NORMAL_NOTIFICATION_ICON;

    await syncAppBadge(notification);

    await self.registration.showNotification(notification.title, {
      body: notification.body,
      tag: notification.tag,
      icon: notificationIcon,
      badge: notificationIcon,
      data: notification.data,
      silent: false,
      vibrate: notification.urgent ? URGENT_NOTIFICATION_VIBRATION : DEFAULT_NOTIFICATION_VIBRATION,
      ...(notification.urgent ? {
        requireInteraction: true
      } : {})
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clearAppBadge().then(() => clients.matchAll({ type: "window", includeUncontrolled: true })).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
