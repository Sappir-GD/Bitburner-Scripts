/** @param {NS} ns */
import { get_all_servers } from "utility.js"
import { install_hacks } from "utility.js"
export async function main(ns: NS) {
	//Note: Functions mutate variables
	ns.disableLog("ALL")

	ns.ui.openTail()

	while (true) {
		//opens ports gain access and nuke
		install_hacks(ns)

		//target server
		const hack_ram = ns.getScriptRam("hack.js", "home")
		const grow_ram = ns.getScriptRam("grow.js", "home")
		const weaken_ram = ns.getScriptRam("weaken.js", "home")

		let servers = get_all_servers(ns)

		let available_targets: string[] = []
		let highest_quality_server: string = ""
		let highest_quality_in_server = 0

		//should have the target
		let longest_time = -1
		let required_hack_threads = 0
		let required_grow_threads = 0
		let required_weaken_threads = 0
		let current_hack_threads = 0
		let current_grow_threads = 0
		let current_weaken_threads = 0
		const target_percentage = 0.01

		let is_playing = true

		for (const server of servers) {
			check_server_quality(server)
		}

		ns.print("\nChecking Prep for " + highest_quality_server)
		ns.print("Money: " + ns.formatNumber(ns.getServerMoneyAvailable(highest_quality_server)) + " / " + ns.formatNumber(ns.getServerMaxMoney(highest_quality_server)))
		ns.print("Security: " + ns.getServerSecurityLevel(highest_quality_server) + " / " + ns.getServerMinSecurityLevel(highest_quality_server))

		//set server to max money and weaken to min_sec
		while (ns.getServerMaxMoney(highest_quality_server) != ns.getServerMoneyAvailable(highest_quality_server) || ns.getServerMinSecurityLevel(highest_quality_server) != ns.getServerSecurityLevel(highest_quality_server)) {
			prep_hack(highest_quality_server)
			ns.print("PrepHacking: " + highest_quality_server)
			ns.print("Money: " + ns.getServerMoneyAvailable(highest_quality_server) + " / " + ns.getServerMaxMoney(highest_quality_server))
			ns.print("Security: " + ns.getServerSecurityLevel(highest_quality_server) + " / " + ns.getServerMinSecurityLevel(highest_quality_server))
			print_threads()

			for (const target of available_targets) {
				hack(target)
			}

			const total_required_threads = required_hack_threads + required_grow_threads + required_weaken_threads
			const total_current_threads = current_hack_threads + current_grow_threads + current_weaken_threads
			ns.print("Threads: " + total_current_threads + "/" + total_required_threads)
			if (total_required_threads == total_current_threads) {
				ns.print("Successful Prep")
			} else {
				ns.print("Prepping more. Missing " + (total_required_threads - total_current_threads) + " threads.")
			}

			//wait to finish
			ns.print("Estimated time: " + ns.tFormat(longest_time))
			await ns.sleep(longest_time + 1000)
			reset_loop_variables()
		}
		let current_loop = 0
		reset_loop_variables()
		ns.print("\nStarting Hack")
		//@ignore-infinite
		while (true) {
			//main loop
			ns.print("\nCurrent_loop: " + current_loop + " for " + highest_quality_server)
			calc_threads(highest_quality_server)
			ns.print("Money: " + ns.formatNumber(ns.getServerMoneyAvailable(highest_quality_server)) + " / " + ns.formatNumber(ns.getServerMaxMoney(highest_quality_server)))
			ns.print("Security: " + ns.getServerSecurityLevel(highest_quality_server) + " / " + ns.getServerMinSecurityLevel(highest_quality_server))

			print_threads()

			//if required total ram is smaller than the space remaining don't do it
			ns.print("Estimated ram usage: " + calculate_ram_usage())
			//subtract the home cost 10 so i can test
			ns.print("Available Ram: " + (get_total_ram() - get_used_ram() - 10))
			if (calculate_ram_usage() < get_total_ram() - get_used_ram() - 10 && check_available_small_ram()) {
				ns.print("Hacking...")
				for (let target of available_targets) {
					hack(target)
				}
			} else {
				ns.print("Aborting...")
				ns.print("Duration: " + ns.tFormat(longest_time))
			}

			const total_required_threads = required_hack_threads + required_grow_threads + required_weaken_threads
			const total_current_threads = current_hack_threads + current_grow_threads + current_weaken_threads

			if (total_required_threads == total_current_threads) {
				ns.print("Successful hack")
			} else {
				ns.print("Failed hack")
				ns.print("Duration: " + ns.tFormat(longest_time))
				await ns.sleep(longest_time + 1000)
				ns.toast("Starting next Batch Cycle")
			}

			reset_loop_variables()
			current_loop += 1

			if ((ns.getServerMoneyAvailable(highest_quality_server) / ns.getServerMaxMoney(highest_quality_server)) < 0.75) {
				restart()
			}

			if (is_playing == false) {
				ns.tprint("Restarting... \n")
				ns.toast("Restarting... \n")
				break
			}
		}

		function print_threads() {
			ns.print("Amount of threads: " + (required_hack_threads + required_grow_threads + required_weaken_threads))
			ns.print("Amount of Hack Thread: " + required_hack_threads)
			ns.print("Amount of Grow Thread: " + required_grow_threads)
			ns.print("Amount of Weaken Thread: " + required_weaken_threads)
		}

		//set a boolean to break out of all loops
		function restart() {
			is_playing = false
		}

		function check_available_small_ram() {
			for (const target of available_targets) {
				const free_ram = ns.getServerMaxRam(target) - ns.getServerUsedRam(target)
				if (free_ram >= hack_ram || free_ram >= grow_ram || free_ram >= weaken_ram) {
					return true
				}
			}
			return false
		}

		function calculate_ram_usage() {
			const hack_ram_usage = required_hack_threads * hack_ram
			const grow_ram_usage = required_grow_threads * grow_ram
			const weaken_ram_usage = required_weaken_threads * weaken_ram
			return hack_ram_usage + grow_ram_usage + weaken_ram_usage
		}

		function get_total_ram() {
			let max_ram = 0
			let used_ram = 0
			for (const server of available_targets) {
				max_ram += ns.getServerMaxRam(server)
			}
			return max_ram
		}

		function get_used_ram() {
			let used_ram = 0
			for (const server of available_targets) {
				used_ram += ns.getServerUsedRam(server)
			}
			return used_ram
		}

		function reset_loop_variables() {
			longest_time = -1
			required_hack_threads = 0
			required_grow_threads = 0
			required_weaken_threads = 0
			current_hack_threads = 0
			current_grow_threads = 0
			current_weaken_threads = 0
		}

		function check_server_quality(passed_target: string) {
			//make sure its hackable
			if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(passed_target) && ns.hasRootAccess(passed_target)) {
				//add it to the available_targets list
				available_targets.push(passed_target)

				//check if its at least half my level or if its level 0...
				if (ns.getHackingLevel() / 2 >= ns.getServerRequiredHackingLevel(passed_target) || ns.getServerRequiredHackingLevel(passed_target) == 0) {
					//calculate based on how good it gets
					let growth_amount = ns.getServerGrowth(passed_target)
					let max_money = ns.getServerMaxMoney(passed_target)
					let min_security = ns.getServerMinSecurityLevel(passed_target)

					let server_quality
					if (ns.getHackingLevel() < 300){
						server_quality = (growth_amount * max_money) / min_security
					}else{
						server_quality = max_money / min_security
					}
					//ns.tprint(passed_target + " quality: " + server_quality.toLocaleString("en-US"))

					//doesn't account for equal quality
					if (highest_quality_in_server < server_quality) {
						highest_quality_in_server = server_quality
						highest_quality_server = passed_target
					}
				}
			}
		}

		function prep_hack(passed_target: string) {
			let grow_time = ns.getGrowTime(passed_target)
			let hack_time = ns.getHackTime(passed_target)
			let weaken_time = ns.getWeakenTime(passed_target)
			let max_time = Math.max(grow_time, hack_time, weaken_time)

			//comes from outside of the function
			longest_time = max_time

			//get amount of threads needed //its okay I didn't pass something in
			let grow_threads = calc_grow_threads(passed_target)
			let weaken_threads = calc_weaken_threads(passed_target)
			weaken_threads += Math.ceil(ns.growthAnalyzeSecurity(grow_threads, passed_target)/ns.weakenAnalyze(1))
			

			//comes from outside of the function
			required_grow_threads = grow_threads
			required_weaken_threads = Math.ceil(weaken_threads * 1.05)
		}

		function calc_threads(passed_target: string) {
			//check for the longest time
			let grow_time = ns.getGrowTime(passed_target)
			let hack_time = ns.getHackTime(passed_target)
			let weaken_time = ns.getWeakenTime(passed_target)
			let max_time = Math.max(grow_time, hack_time, weaken_time)

			//comes from outside of the function
			longest_time = max_time

			//calculate threads needed
			let hack_threads = calc_hack_threads(passed_target, target_percentage)
			let grow_threads = calc_grow_threads(passed_target, target_percentage)
			let weaken_threads = Math.ceil((ns.hackAnalyzeSecurity(hack_threads, passed_target)) + (ns.growthAnalyzeSecurity(grow_threads, passed_target, 1)) / ns.weakenAnalyze(1))

			//comes from outside of the function
			required_hack_threads = hack_threads
			required_grow_threads = grow_threads
			required_weaken_threads = Math.ceil(weaken_threads * 1.05)
		}

		function hack(passed_target: string) {
			const hack_check = (current_hack_threads < required_hack_threads)
			const grow_check = (current_grow_threads < required_grow_threads)
			const weaken_check = (current_weaken_threads < required_weaken_threads)

			let available_ram = ns.getServerMaxRam(passed_target) - ns.getServerUsedRam(passed_target)
			//I need the space to test things
			if (passed_target == "home") {
				available_ram = ns.getServerMaxRam(passed_target) - (ns.getServerUsedRam(passed_target) + 10)
			}
			let has_ram = check_ram(available_ram)


			if (grow_check && has_ram) {
				current_grow_threads = check_helper(required_grow_threads, current_grow_threads, "grow.js", ns.getGrowTime(highest_quality_server))
			}
			if (hack_check && has_ram) {
				current_hack_threads = check_helper(required_hack_threads, current_hack_threads, "hack.js", ns.getHackTime(highest_quality_server))
			}
			if (weaken_check && has_ram) {
				current_weaken_threads = check_helper(required_weaken_threads, current_weaken_threads, "weaken.js", ns.getWeakenTime(highest_quality_server))
			}


			//check if you need anymore hacks
			if (hack_check && grow_check && weaken_check)
				return true
			else
				return false

			function check_helper(required: number, current: number, script: string, duration: number) {
				const script_ram = ns.getScriptRam(script, "home")

				const possible_thread_amount = Math.floor(available_ram / script_ram)
				const needed_threads = required - current

				const threads_to_use = Math.min(possible_thread_amount, needed_threads)
				if (threads_to_use > 0) {
					const has_succeeded = ns.exec(script, passed_target, threads_to_use, ...[highest_quality_server, longest_time - duration])
					if (has_succeeded != 0) {
						available_ram -= threads_to_use * script_ram
						current += threads_to_use
						has_ram = check_ram(available_ram)
					}
				}

				return current
			}

			function check_ram(passed_ram: number) {
				if (passed_ram > hack_ram || passed_ram > grow_ram || passed_ram > weaken_ram) {
					return true
				} else return false
			}
		}


		function calc_hack_threads(passed_target: string, passed_pecentage: number) {
			const money = Math.max(ns.getServerMoneyAvailable(passed_target), 1)

			return Math.ceil(ns.hackAnalyzeThreads(passed_target, money * passed_pecentage))
		}

		function calc_grow_threads(passed_target: string, passed_pecentage: number = 0) {
			const money = Math.max(ns.getServerMoneyAvailable(passed_target), 1)
			const max_money = ns.getServerMaxMoney(passed_target)

			const target_percent = passed_pecentage ? 1 / (1 - passed_pecentage) : (max_money / money)

			return Math.ceil(ns.growthAnalyze(passed_target, target_percent))
		}

		function calc_weaken_threads(passed_target: string) {
			const min_sec = ns.getServerMinSecurityLevel(passed_target)
			const sec = ns.getServerSecurityLevel(passed_target)
			const weaken_threads = Math.ceil((sec - min_sec) / ns.weakenAnalyze(1, 1))

			return weaken_threads
		}
	}
}

