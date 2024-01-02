import {makeAutoObservable, runInAction} from "mobx";
import {BaseStore} from "./BaseStore.ts";

const baseAPI = 'https://api.float32.app/query'
const historyAPI = 'https://api.float32.app/history?id='
class reqStore {
  public get shareLink() {
    if (!this.shareId || this.shareId === '') {
      return 'https://float32.app'
    }
    return 'https://float32.app/search?id=' + this.shareId
  }

  public constructor() {
    makeAutoObservable(this)
  }
  public isRainbow = false

  public evidenceList: Array<Evidence> = []
  public relatedList: Array<string> = []

  //region isLoading
  public get isLoading() {
    return this._isLoading
  }
  public set isLoading(v: boolean) {
    this._isLoading = v
  }
  public _isLoading: boolean = false
  //endregion

  public isFailed: boolean = false
  public shareId = ''
  public question = ''
  public warning = ''
  public currentAns: string = ''
  private _currentHistory = ''

  public async queryHistory(id: string) {
    if (this.isLoading) return
    if (id === this._currentHistory) return
    this._currentHistory = id
    this.shareId = id

    this.isLoading = true
    this.isFailed = false
    this.currentAns = ''
    this.evidenceList = []
    await fetch(historyAPI+id, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
    }).then(async (res) => {
      // decode res to json
      res.json().then((json) => {
        runInAction(() => {
          this.isLoading = false
          this.isFailed = false
          this.currentAns = json.answer ?? ''
          BaseStore.question = this.question = json.question ?? ''
          this.evidenceList = json.evidence ?? []
          this.relatedList = json.related ?? []
        })
      })

    }).catch((e) => {
      runInAction(() => {
        this.isFailed = true
        this.isLoading = false
        this.currentAns = 'Error: ' + e
      })
      return
    })
  }

  public async queryQuestion(question: string, lang: string, field : string, progLang: string) {
    if (this.isLoading) return

    this.isLoading = true
    this.isFailed = false
    this.currentAns = ''
    this.evidenceList = []
    this.shareId = ''

    await fetch(baseAPI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'question': question,
        'language': lang,
        'prog_lang': progLang,
        'field': field,
      })
    }).then(async (res) => {
      let buf = ''
      let hasDoneMeta = false
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
      while (true) {
        const {done, value} = await reader.read();
        if (value !== undefined) {
          if (hasDoneMeta) {
            this.currentAns = this.currentAns + value
            continue
          }
          buf = buf + value
          const idx = buf.indexOf('\r\n')
          if (idx !== -1) {
            const meta = buf.slice(0, idx)
            console.log(meta)
            const metaObj : AnsMetaInfo = JSON.parse(meta)
            this.evidenceList = metaObj.evidences
            this.currentAns = buf.slice(idx + 2)
            this.shareId = metaObj.id
            window.history.replaceState(null, '', '/search?id=' + metaObj.id)
            hasDoneMeta = true
            continue
          }
        }
        if (done) break;
      }
      this.isLoading = false
    }).catch((r) => {
      this.isFailed = true
      this.isLoading = false
      this.currentAns = 'Error: ' + r
      return
    })
  }
}

export interface AnsMetaInfo {
  evidences: Evidence[]
  id: string
}

export  interface Evidence {
  url: string
  title: string
  description: string
}

export default new reqStore()
