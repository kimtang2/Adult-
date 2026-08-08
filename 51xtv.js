// ============================================================
//  KissJAV - 测试版（只返回分类，不抓取数据）
//  用于验证 MiraPlay 是否能正常加载这个 JS 文件
// ============================================================

var rule = {
    sites: [
        {
            name: 'KissJAV-Test',
            url: 'https://kissjav.li',
            type: 3,
            home: 'test_home'
        }
    ]
};

// 简单测试函数：只返回固定的分类，不抓取任何数据
function test_home() {
    return {
        class: [
            { type_id: 'latest', type_name: 'Latest' },
            { type_id: 'most', type_name: 'Most Viewed' }
        ],
        list: []  // 空列表，只测试分类显示
    };
}

// 挂载全局
globalThis.test_home = test_home;

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = rule;
} else {
    window.rule = rule;
}
