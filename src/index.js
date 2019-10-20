const puppeteer = require('puppeteer')
const { resolve } = require('path')
const fs = require('fs')

const isMac = /Darwin/.test(require('os').type())

let keyWord = ''
let target = []
let deleteCount = 0

try {
  const config = fs.readFileSync(resolve(__dirname, '../config'), 'utf-8')
  keyWord = config.match(/(?<=要删除的关键词\(顿号分隔\)：\n).+/)[0].split('、').join('|')
  target = config.match(/(?<=要处理的序号\(顿号分隔\)：\n).+/)[0].split('、')
  target.sort((a, b) => a - b)
} catch (e) {
  console.log('配置文件缺失或格式错误，请重新填写')
}

const fetchMore = async (page) => {
  const maxNumber = target[target.length - 1]
  let fetchCount = Math.ceil(maxNumber / 12) - 1
  while (fetchCount--) {
    await page.waitForSelector('.anticon-down', { visible: true, timeout: 0 })
    await page.click('.anticon-down')
    await page.waitForSelector('.anticon-loading', { visible: true, timeout: 0 })
    await page.waitForSelector('.anticon-loading', { hidden: true, timeout: 0 })
  }
}

const searchTarget = async (page, targetNumber) => {
  await page.waitForSelector('.production .ant-tabs-content .ant-tabs-tabpane .ant-spin-container div', {
    visible: true,
    timeout: 0
  })
  if (!targetNumber) return false
  return await page.evaluate(number => {
    const oldElement = document.querySelector('.active-puppeteer')
    oldElement && oldElement.classList.remove('active-puppeteer')
    const items = document.querySelectorAll('.production .ant-tabs-content .ant-tabs-tabpane .ant-spin-container > div > span')
    for (const item of items) {
      if (Number(number) === Number(item.innerText)) {
        item.parentElement.classList.add('active-puppeteer')
        item.style.backgroundColor = 'aquamarine'
        return true
      }
    }
    return false
  }, targetNumber)
}

const deleteComment = async (page) => {
  while (1) {
    await page.waitForSelector('.ant-table-tbody', { visible: true, timeout: 0 })
    let deleteCount = await page.evaluate(regText => {
      let count = 0
      const commentList = document.querySelectorAll('.ant-table-tbody tr')
      for (const comment of commentList) {
        if (new RegExp(regText).test(comment.querySelector('p').innerText)) {
          const operation = comment.querySelectorAll('a')
          for (const button of operation) {
            if (button.innerText === '删除') {
              count++
              button.classList.add('puppeteer-delete')
            }
          }
        }
      }
      return count
    }, keyWord)
    while (deleteCount--) {
      await page.click('.puppeteer-delete')
      await page.waitForSelector('.ant-modal-body .ant-btn-primary', { visible: true, timeout: 0 })
      await page.click('.ant-modal-body .ant-btn-primary')
      await page.waitForSelector('.ant-modal-confirm-success .ant-btn-primary', { visible: true, timeout: 0 })
      await page.click('.ant-modal-confirm-success .ant-btn-primary')
      deleteCount++
      await page.waitForSelector('.ant-modal-body', { hidden: true, timeout: 0 })
    }
    if (await page.$('.ant-pagination-next:not(.ant-pagination-disabled)')) {
      await page.click('.ant-pagination-item-active + .ant-pagination-item')
      await page.waitForSelector('.ant-spin-blur', { visible: true, timeout: 0 })
      await page.waitForSelector('.ant-spin-blur', { hidden: true, timeout: 0 })
    } else {
      await page.click('.ant-drawer-close')
      break
    }
  }
}


const run = async (page) => {
  await page.waitForSelector('.explanation', { hidden: true, timeout: 0 })
  await fetchMore(page)
  for (const itemNumber of target) {
    if (await searchTarget(page, itemNumber)) {
      await page.waitForSelector('.ant-drawer-open', { hidden: true, timeout: 0 })
      await page.waitForSelector('.active-puppeteer .ant-btn', { visible: true, timeout: 0 })
      await page.click('.active-puppeteer .ant-btn')
      await page.waitForSelector('.ant-table-tbody a', { visible: true, timeout: 0 })
      await deleteComment(page)
    }
  }
  console.log(`已删除${deleteCount}条`)
}


const sleep = () => new Promise(resolve => {
  setTimeout(resolve, 1000 * 60 * 10)
})

void (async () => {
  const browser = await puppeteer.launch({
    executablePath: resolve(__dirname, isMac ? '../chrome-mac/Chromium.app/Contents/MacOS/Chromium' : '../chrome-win/chrome.exe'),
    headless: false,
    defaultViewport: {
      width: 1500,
      height: 800
    }
  })
  const page = await browser.newPage()
  await page.goto('https://e.douyin.com/site/manage-center/content-manage')
  while (1) {
    await run(page)
    console.log('等待下一轮任务...')
    await sleep()
    page.reload()
  }
})()